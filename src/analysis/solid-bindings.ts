import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { trace } from "../utils.js";
import { getTypeAwareServices, resolveTypeAwareSolidCallee } from "./typescript-semantics.js";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

export type ReactiveBindingRole = "accessor" | "action" | "setter" | "store";

export interface ReactiveBindingFact {
  role: ReactiveBindingRole;
  factory: string;
  declaration: T.VariableDeclarator;
  tupleIndex: number | null;
}

const SINGLE_RESULT_FACTORIES = new Map<string, ReactiveBindingRole>([
  ["action", "action"],
  ["createMemo", "accessor"],
  ["createProjection", "store"],
]);

const PAIR_RESULT_FACTORIES = new Map<string, readonly [ReactiveBindingRole, ReactiveBindingRole]>([
  ["createOptimistic", ["accessor", "setter"]],
  ["createOptimisticStore", ["store", "setter"]],
  ["createSignal", ["accessor", "setter"]],
  ["createStore", ["store", "setter"]],
]);

const REACTIVE_FACTORIES = new Set([
  ...SINGLE_RESULT_FACTORIES.keys(),
  ...PAIR_RESULT_FACTORIES.keys(),
]);

/** Whether a node is an `import ... from "solid-js"` declaration. */
export function isSolidJsImportDeclaration(
  node: T.Node | null | undefined,
): node is T.ImportDeclaration {
  return (
    node?.type === "ImportDeclaration" &&
    node.source.type === "Literal" &&
    node.source.value === "solid-js"
  );
}

function namespaceMemberName(
  node: T.Node,
  context: RuleContext,
): { name: string; imported: boolean } | null {
  if (
    node.type !== "MemberExpression" ||
    node.optional ||
    node.object.type !== "Identifier" ||
    node.property.type !== "Identifier" ||
    node.computed
  ) {
    return null;
  }

  const variable = ASTUtils.findVariable(context.sourceCode.getScope(node.object), node.object);
  const imported = variable?.defs.some(
    (def) =>
      def.type === "ImportBinding" &&
      def.node.type === "ImportNamespaceSpecifier" &&
      isSolidJsImportDeclaration(def.node.parent),
  );
  return { name: node.property.name, imported: imported === true };
}

/**
 * Resolves a direct, aliased, or namespace-qualified expression to its canonical Solid export.
 * Bare canonical names count only when truly unresolved (auto-import/global).
 */
export function resolveSolidCallee(
  node: T.Node,
  context: RuleContext,
  canonicalNames: ReadonlySet<string>,
): string | null {
  const traced = trace(node, context);

  if (traced.type === "Identifier" && canonicalNames.has(traced.name)) {
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(traced), traced);
    return variable == null || variable.defs.length === 0 ? traced.name : null;
  }

  if (traced.type === "ImportSpecifier" && isSolidJsImportDeclaration(traced.parent)) {
    const importedName =
      traced.imported.type === "Identifier" ? traced.imported.name : traced.imported.value;
    return canonicalNames.has(importedName) ? importedName : null;
  }

  const member = namespaceMemberName(traced, context);
  return member?.imported === true && canonicalNames.has(member.name) ? member.name : null;
}

export function bindsToSolid(
  node: T.Node,
  context: RuleContext,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return resolveSolidCallee(node, context, canonicalNames) != null;
}

function getChildNodes(node: T.Node): T.Node[] {
  const children: T.Node[] = [];
  for (const key in node) {
    if (key === "parent" || key === "tokens" || key === "comments") {
      continue;
    }
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && typeof item === "object" && typeof (item as T.Node).type === "string") {
          children.push(item as T.Node);
        }
      }
    } else if (
      value != null &&
      typeof value === "object" &&
      typeof (value as T.Node).type === "string"
    ) {
      children.push(value as T.Node);
    }
  }
  return children;
}

function declaredVariable(
  declarator: T.VariableDeclarator,
  id: T.Identifier,
  sourceCode: TSESLint.SourceCode,
): TSESLint.Scope.Variable | null {
  return (
    sourceCode.scopeManager
      ?.getDeclaredVariables(declarator)
      .find((variable) => variable.name === id.name) ?? null
  );
}

const baseReactiveBindingCache = new WeakMap<
  TSESLint.SourceCode,
  ReadonlyMap<TSESLint.Scope.Variable, ReactiveBindingFact>
>();
const typeAwareReactiveBindingCache = new WeakMap<
  TSESLint.SourceCode,
  ReadonlyMap<TSESLint.Scope.Variable, ReactiveBindingFact>
>();

function buildReactiveBindingFacts(
  sourceCode: TSESLint.SourceCode,
  context: RuleContext,
): ReadonlyMap<TSESLint.Scope.Variable, ReactiveBindingFact> {
  const facts = new Map<TSESLint.Scope.Variable, ReactiveBindingFact>();
  const aliases: Array<{
    target: TSESLint.Scope.Variable;
    source: TSESLint.Scope.Variable;
  }> = [];
  const services = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled
    ? getTypeAwareServices(context)
    : null;
  const stack: T.Node[] = [sourceCode.ast];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === "VariableDeclarator") {
      const declaration = node.parent;
      if (
        declaration?.type === "VariableDeclaration" &&
        declaration.kind === "const" &&
        node.id.type === "Identifier" &&
        node.init?.type === "Identifier"
      ) {
        const target = declaredVariable(node, node.id, sourceCode);
        const source = ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
        if (target && source) {
          aliases.push({ target, source });
        }
      }

      if (node.init?.type === "CallExpression") {
        const factory =
          resolveSolidCallee(node.init.callee, context, REACTIVE_FACTORIES) ??
          (services == null
            ? null
            : resolveTypeAwareSolidCallee(node.init.callee, services, REACTIVE_FACTORIES));
        if (factory != null) {
          const singleRole = SINGLE_RESULT_FACTORIES.get(factory);
          if (singleRole != null && node.id.type === "Identifier") {
            const variable = declaredVariable(node, node.id, sourceCode);
            if (variable) {
              facts.set(variable, {
                role: singleRole,
                factory,
                declaration: node,
                tupleIndex: null,
              });
            }
          }

          const pairRoles = PAIR_RESULT_FACTORIES.get(factory);
          if (pairRoles != null && node.id.type === "ArrayPattern") {
            for (const tupleIndex of [0, 1] as const) {
              const id = node.id.elements[tupleIndex];
              if (id?.type !== "Identifier") {
                continue;
              }
              const variable = declaredVariable(node, id, sourceCode);
              if (variable) {
                facts.set(variable, {
                  role: pairRoles[tupleIndex],
                  factory,
                  declaration: node,
                  tupleIndex,
                });
              }
            }
          }
        }
      }
    }

    stack.push(...getChildNodes(node));
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const { target, source } of aliases) {
      if (facts.has(target)) {
        continue;
      }
      const fact = facts.get(source);
      if (fact) {
        facts.set(target, fact);
        changed = true;
      }
    }
  }

  return facts;
}

export function getReactiveBindingFacts(
  context: RuleContext,
): ReadonlyMap<TSESLint.Scope.Variable, ReactiveBindingFact> {
  const sourceCode = context.sourceCode;
  const typeAware =
    (context.options[0] as { typescriptEnabled?: boolean } | undefined)?.typescriptEnabled === true;
  const cache = typeAware ? typeAwareReactiveBindingCache : baseReactiveBindingCache;
  const cached = cache.get(sourceCode);
  if (cached) {
    return cached;
  }
  const facts = buildReactiveBindingFacts(sourceCode, context);
  cache.set(sourceCode, facts);
  return facts;
}

export function getReactiveBindingFact(
  node: T.Identifier,
  context: RuleContext,
): ReactiveBindingFact | null {
  const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node);
  return variable ? (getReactiveBindingFacts(context).get(variable) ?? null) : null;
}

export function getReactiveBindingFactForVariable(
  variable: TSESLint.Scope.Variable,
  context: RuleContext,
): ReactiveBindingFact | null {
  return getReactiveBindingFacts(context).get(variable) ?? null;
}
