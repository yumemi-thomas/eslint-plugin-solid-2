import * as ts from "typescript";
import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, type FunctionNode } from "../utils.js";
import { bindsToSolid, isSolidJsImportDeclaration } from "../analysis/solid-bindings.js";
import type { TypeAwareServices } from "../analysis/typescript-semantics.js";

export { bindsToSolid, resolveSolidCallee } from "../analysis/solid-bindings.js";
export { hasSolidComponentTypeAnnotation, isComponent } from "../analysis/component-recognition.js";
export { getTypeAwareServices, type TypeAwareServices } from "../analysis/typescript-semantics.js";

type SolidRuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

function expressionCanYieldJsx(node: T.Expression | null | undefined): boolean {
  switch (node?.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "ConditionalExpression":
      return expressionCanYieldJsx(node.consequent) || expressionCanYieldJsx(node.alternate);
    case "LogicalExpression":
      return expressionCanYieldJsx(node.left) || expressionCanYieldJsx(node.right);
    case "SequenceExpression":
      return expressionCanYieldJsx(node.expressions.at(-1));
    default:
      return false;
  }
}

/** Whether any `return` in the function (or an arrow's expression body) yields JSX. */
export function functionReturnsJsx(node: FunctionNode): boolean {
  if (node.body.type !== "BlockStatement") {
    return expressionCanYieldJsx(node.body);
  }

  const statements: T.Statement[] = [...node.body.body];
  while (statements.length > 0) {
    const statement = statements.pop()!;
    switch (statement.type) {
      case "BlockStatement":
        statements.push(...statement.body);
        break;
      case "IfStatement":
        statements.push(statement.consequent);
        if (statement.alternate) {
          statements.push(statement.alternate);
        }
        break;
      case "LabeledStatement":
      case "WithStatement":
        statements.push(statement.body);
        break;
      case "SwitchStatement":
        for (const switchCase of statement.cases) {
          statements.push(...switchCase.consequent);
        }
        break;
      case "TryStatement":
        statements.push(statement.block);
        if (statement.handler) {
          statements.push(statement.handler.body);
        }
        if (statement.finalizer) {
          statements.push(statement.finalizer);
        }
        break;
      case "ReturnStatement":
        if (expressionCanYieldJsx(statement.argument)) {
          return true;
        }
        break;
      default:
        break;
    }
  }

  return false;
}

/**
 * Verdict on whether `node`'s type is array-like (an array or tuple — i.e. has a numeric index
 * signature), considering every union member:
 *
 * - `"array"` — provably array-like; safe to rewrite `.map` to `<For each>`.
 * - `"not-array"` — provably not (a `Map`/`Set`/observable); `prefer-for` skips the report.
 * - `"unknown"` — the type can't be resolved, is `any`/`unknown`, or mixes array and non-array
 *   members. `prefer-for` stays silent because a rewrite may be semantically wrong.
 */
export function getArrayReceiverVerdict(
  node: T.Node,
  services: TypeAwareServices,
): "array" | "not-array" | "unknown" {
  const tsNode = services.esTreeNodeToTSNodeMap.get(node);
  if (!tsNode) {
    return "unknown";
  }

  const checker = services.program.getTypeChecker();
  const type = checker.getTypeAtLocation(tsNode);
  const members = type.isUnion() ? type.types : [type];
  if (members.some((member) => member.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))) {
    return "unknown";
  }
  const arrayMembers = members.filter(
    (member) => checker.getIndexTypeOfType(member, ts.IndexKind.Number) != null,
  );
  if (arrayMembers.length === members.length) {
    return "array";
  }
  return arrayMembers.length === 0 ? "not-array" : "unknown";
}

/**
 * Whether `identifier` actually refers to the Solid API for one of `canonicalNames` — a name
 * imported from "solid-js" (directly or aliased), a `const` alias of one (`const c = onCleanup`),
 * or an unresolved global (auto-import). Returns false when it binds to the user's own declaration
 * or an import from another package, which prevents false positives on same-named non-Solid
 * functions (a stream library's `flush`, a state library's `createStore`, a local `onCleanup`, ...).
 *
 * Delegates to {@link resolveSolidCallee}, whose `trace` step resolves both aliased imports and
 * `const` aliases — so no caller needs to pre-collect import aliases (see ADR-0003).
 */
/** Whether `node` is the `argumentIndex`th argument of a call whose callee binds to the Solid API. */
export function isSolidApiCallbackArgument(
  node: FunctionNode,
  argumentIndex: number,
  context: SolidRuleContext,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return (
    node.parent?.type === "CallExpression" &&
    node.parent.arguments[argumentIndex] === node &&
    bindsToSolid(node.parent.callee, context, canonicalNames)
  );
}

export function getReturnedExpression(node: FunctionNode): T.Expression | null {
  if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
    return node.body;
  }

  if (node.body.type !== "BlockStatement") {
    return null;
  }

  for (const statement of node.body.body) {
    if (statement.type === "ReturnStatement") {
      return statement.argument ?? null;
    }
  }

  return null;
}

export function getReturnedExpressions(node: FunctionNode): Array<T.Expression | null> {
  if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement") {
    return [node.body];
  }

  if (node.body.type !== "BlockStatement") {
    return [];
  }

  const returned: Array<T.Expression | null> = [];
  const statements: T.Statement[] = [...node.body.body];

  while (statements.length > 0) {
    const statement = statements.pop()!;
    switch (statement.type) {
      case "BlockStatement":
        statements.push(...statement.body);
        break;
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "ForStatement":
      case "WhileStatement":
      case "LabeledStatement":
      case "WithStatement":
        statements.push(statement.body);
        break;
      case "IfStatement":
        statements.push(statement.consequent);
        if (statement.alternate) {
          statements.push(statement.alternate);
        }
        break;
      case "SwitchStatement":
        for (const switchCase of statement.cases) {
          statements.push(...switchCase.consequent);
        }
        break;
      case "TryStatement":
        statements.push(statement.block);
        if (statement.handler) {
          statements.push(statement.handler.body);
        }
        if (statement.finalizer) {
          statements.push(statement.finalizer);
        }
        break;
      case "ReturnStatement":
        returned.push(statement.argument ?? null);
        break;
      default:
        break;
    }
  }

  return returned;
}

export function getPropertyName(node: T.Property): string | null {
  if (!node.computed && node.key.type === "Identifier") {
    return node.key.name;
  }

  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value;
  }

  return null;
}

export function getNearestFunctionAncestor(node: T.Node): FunctionNode | null {
  let current = node.parent;
  while (current != null) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Resolves an identifier to the canonical Solid API name it refers to, or null. The `trace` step
 * follows both aliased imports (`import { createEffect as fx }`) and `const` aliases to their
 * origin, so an aliased Solid API resolves to its **canonical** name (`"createEffect"`), not the
 * local alias. A bare canonical name is trusted only when unresolved (an auto-import/global); a
 * name bound to a local declaration or a non-solid-js import resolves to null.
 */
export function isNestedFunction(node: T.Node): node is FunctionNode {
  return isFunctionNode(node);
}

/** Whether any scope in the file already declares `name`. */
export function isNameTaken(sourceCode: TSESLint.SourceCode, name: string): boolean {
  return sourceCode.scopeManager?.scopes.some((scope) => scope.set.has(name)) ?? false;
}

/**
 * Fixes that make `names` importable from solid-js at the fix site, so an autofix that emits
 * `<Show>`/`<For>`/... never produces non-compiling code. Returns `[]` when every name is already
 * imported from solid-js under its own name, a fix extending (or creating) the solid-js import for
 * the missing ones, or `null` when a missing name is already bound to something else in the file —
 * callers must then skip their autofix rather than emit a reference that resolves to the wrong
 * binding.
 */
export function getSolidImportFixes(
  context: SolidRuleContext,
  fixer: TSESLint.RuleFixer,
  names: readonly string[],
): TSESLint.RuleFix[] | null {
  const sourceCode = context.sourceCode;
  const importNode = sourceCode.ast.body.find(
    (node): node is T.ImportDeclaration =>
      isSolidJsImportDeclaration(node) && node.importKind !== "type",
  );

  const available = new Set<string>();
  for (const specifier of importNode?.specifiers ?? []) {
    if (
      specifier.type === "ImportSpecifier" &&
      specifier.imported.type === "Identifier" &&
      specifier.imported.name === specifier.local.name
    ) {
      available.add(specifier.local.name);
    }
  }

  const missing = names.filter((name) => !available.has(name));
  if (missing.length === 0) {
    return [];
  }
  if (missing.some((name) => isNameTaken(sourceCode, name))) {
    return null;
  }

  const lastNamed = importNode?.specifiers.findLast(
    (specifier) => specifier.type === "ImportSpecifier",
  );
  if (lastNamed != null) {
    return [fixer.insertTextAfter(lastNamed, `, ${missing.join(", ")}`)];
  }

  const firstStatement = sourceCode.ast.body[0];
  const importText = `import { ${missing.join(", ")} } from "solid-js";\n`;
  return [
    firstStatement != null
      ? fixer.insertTextBefore(firstStatement, importText)
      : fixer.insertTextAfterRange([0, 0], importText),
  ];
}
