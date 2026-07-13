import * as ts from "typescript";
import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import {
  getFunctionName,
  isDOMElementName,
  isFunctionNode,
  trace,
  type FunctionNode,
} from "../utils.js";

type SolidRuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

// Solid's component type aliases. A function annotated with one of these is, by the author's
// own declaration, a component — a signal no plain helper carries.
const SOLID_COMPONENT_TYPES = new Set([
  "Component",
  "VoidComponent",
  "ParentComponent",
  "FlowComponent",
]);

/** Whether a node is an `import ... from "solid-js"` declaration. The single source of truth for
 * "this binding comes from solid-js", shared by the callee, type-annotation, and alias resolvers. */
function isSolidJsImportDeclaration(node: T.Node | null | undefined): node is T.ImportDeclaration {
  return (
    node?.type === "ImportDeclaration" &&
    node.source.type === "Literal" &&
    node.source.value === "solid-js"
  );
}

function typeReferenceName(node: T.TypeNode | undefined): string | null {
  if (node?.type !== "TSTypeReference") {
    return null;
  }

  if (node.typeName.type === "Identifier") {
    return node.typeName.name;
  }

  if (node.typeName.type === "TSQualifiedName" && node.typeName.right.type === "Identifier") {
    return node.typeName.right.name;
  }

  return null;
}

/**
 * The identifier that carries the binding for a type reference: the type name itself for a plain
 * `Component`, or the leftmost segment for a qualified `Solid.Component` (i.e. the namespace root).
 * `qualified` distinguishes the two so the binding check can demand an explicit solid-js import for
 * the qualified form (an unresolved `Solid.Component` is not a Solid auto-import).
 */
function typeReferenceRootIdentifier(
  node: T.TypeNode | undefined,
): { id: T.Identifier; qualified: boolean } | null {
  if (node?.type !== "TSTypeReference") {
    return null;
  }

  let name: T.EntityName = node.typeName;
  let qualified = false;
  while (name.type === "TSQualifiedName") {
    qualified = true;
    name = name.left;
  }

  return name.type === "Identifier" ? { id: name, qualified } : null;
}

/**
 * Whether a component type-name identifier actually refers to Solid's type — the type-annotation
 * analogue of {@link resolveSolidCallee} (see ADR-0003). It counts as Solid when the name binds to a
 * `solid-js` import, or (for a bare name only) is unresolved — an ambient/auto-import global. A name
 * that binds to a local `type`/`interface` declaration or an import from another package is *not*
 * Solid, which is what keeps `hasSolidComponentTypeAnnotation` from firing on same-named non-Solid
 * types (a UI kit's `Component`, a local `VoidComponent`, a foreign `Ns.Component`).
 */
function typeNameBindsToSolid(
  id: T.Identifier,
  qualified: boolean,
  context: SolidRuleContext,
): boolean {
  // Resolve in the TYPE namespace: a same-named value binding (`const Component = ...`) must not
  // shadow the type, so we only consider type-space defs (type/interface, class, enum, an import).
  // The nearest such binding wins; if none exists the name is unresolved.
  let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(id);
  while (scope) {
    for (const variable of scope.variables) {
      if (variable.name !== id.name) {
        continue;
      }

      for (const def of variable.defs) {
        if (def.type === "ImportBinding") {
          return isSolidJsImportDeclaration(def.node.parent);
        }

        if (def.type === "Type" || def.type === "ClassName" || def.type === "TSEnumName") {
          // A local `type`/`interface`/`class`/`enum` of this name — not Solid's type.
          return false;
        }
      }
    }

    scope = scope.upper;
  }

  // Unresolved: a bare auto-import/ambient global is treated as Solid (matching resolveSolidCallee);
  // a qualified root (`Ns.Component`) is never an auto-import, so it is not Solid.
  return !qualified;
}

/**
 * Whether the function is declared with an explicit Solid component type annotation,
 * e.g. `const C: Component<P> = (props) => ...`. This is a *sound* signal of component-hood:
 * it is never true for a plain JSX-returning helper, and holds across file boundaries. The type
 * must actually resolve to Solid's `Component`/`VoidComponent`/… (not a same-named local or
 * third-party type) — see {@link typeNameBindsToSolid} and ADR-0002/0003.
 */
export function hasSolidComponentTypeAnnotation(
  node: FunctionNode,
  context: SolidRuleContext,
): boolean {
  const parent = node.parent;
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    const annotation = parent.id.typeAnnotation?.typeAnnotation;
    const name = typeReferenceName(annotation);
    if (name == null || !SOLID_COMPONENT_TYPES.has(name)) {
      return false;
    }

    const root = typeReferenceRootIdentifier(annotation);
    return root != null && typeNameBindsToSolid(root.id, root.qualified, context);
  }

  return false;
}

// The variables a file renders as a component (`<C/>`), resolved by **binding** — not name —
// computed once per source and memoized. Only a *direct* identifier tag counts: a lowercase tag
// (`<div>`, `<summary>`) is a host element and is skipped, and a member tag (`<Foo.Bar/>`) renders
// the property `Foo.Bar`, not the root `Foo` — so a function is a component only when used as a
// bare `<Fn/>`. The tag is resolved to the variable it actually references, so a local helper whose
// name merely collides with an imported component is not conflated with it (ADR-0002/0003). Built
// from the whole AST, so the answer is complete the first time any rule asks — which lets
// `isComponent` be queried inline during traversal rather than deferred to `Program:exit`. Keyed on
// the per-file SourceCode (auto-released with it).
const inFileComponentVarsCache = new WeakMap<
  TSESLint.SourceCode,
  ReadonlySet<TSESLint.Scope.Variable>
>();

function getInFileComponentVariables(
  sourceCode: TSESLint.SourceCode,
): ReadonlySet<TSESLint.Scope.Variable> {
  const cached = inFileComponentVarsCache.get(sourceCode);
  if (cached) {
    return cached;
  }

  const vars = new Set<TSESLint.Scope.Variable>();
  const stack: T.Node[] = [sourceCode.ast];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (
      node.type === "JSXOpeningElement" &&
      node.name.type === "JSXIdentifier" &&
      !isDOMElementName(node.name.name)
    ) {
      const variable = ASTUtils.findVariable(sourceCode.getScope(node.name), node.name.name);
      if (variable != null) {
        vars.add(variable);
      }
    }

    for (const key in node) {
      // `parent` back-references would cycle; `tokens`/`comments` hang off the Program node and are
      // not AST children — walking them would visit every token in the file for nothing.
      if (key === "parent" || key === "tokens" || key === "comments") {
        continue;
      }
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (
            item != null &&
            typeof item === "object" &&
            typeof (item as T.Node).type === "string"
          ) {
            stack.push(item as T.Node);
          }
        }
      } else if (
        value != null &&
        typeof value === "object" &&
        typeof (value as T.Node).type === "string"
      ) {
        stack.push(value as T.Node);
      }
    }
  }

  inFileComponentVarsCache.set(sourceCode, vars);
  return vars;
}

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

export interface TypeAwareServices {
  program: ts.Program;
  esTreeNodeToTSNodeMap: { get(node: T.Node): ts.Node | undefined };
}

export function getTypeAwareServices(context: SolidRuleContext): TypeAwareServices | null {
  const services = context.sourceCode.parserServices;
  if (services?.program != null && services.esTreeNodeToTSNodeMap != null) {
    return services as unknown as TypeAwareServices;
  }

  return null;
}

// All symbols referenced as a JSX tag anywhere in the program, computed once per program.
const jsxTagSymbolsCache = new WeakMap<ts.Program, Set<ts.Symbol>>();

function resolveAlias(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function getJsxTagSymbols(services: TypeAwareServices): Set<ts.Symbol> {
  const program = services.program;
  const cached = jsxTagSymbolsCache.get(program);
  if (cached) {
    return cached;
  }

  const checker = program.getTypeChecker();
  const symbols = new Set<ts.Symbol>();

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const symbol = checker.getSymbolAtLocation(node.tagName);
      if (symbol) {
        symbols.add(resolveAlias(symbol, checker));
      }
    }
    ts.forEachChild(node, visit);
  };

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes("/node_modules/")) {
      continue;
    }
    visit(sourceFile);
  }

  jsxTagSymbolsCache.set(program, symbols);
  return symbols;
}

function getFunctionSymbol(node: FunctionNode, services: TypeAwareServices): ts.Symbol | undefined {
  let nameNode: T.Identifier | undefined;
  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.id != null
  ) {
    nameNode = node.id;
  } else if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    nameNode = node.parent.id;
  }

  if (!nameNode) {
    return undefined;
  }

  const tsNode = services.esTreeNodeToTSNodeMap.get(nameNode);
  return tsNode ? services.program.getTypeChecker().getSymbolAtLocation(tsNode) : undefined;
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
 * Sound component detection (see docs/adr/0002). A function is treated as a Solid component only by
 * signals that are never true for a plain helper — never the leaky "capitalized JSX-returning
 * function" guess:
 *
 * - **Always:** it is annotated `Component`/`VoidComponent`/… or used as `<C/>` in the same file.
 * - **Only when `typescriptEnabled` and type info is present:** additionally, its symbol is used as
 *   a JSX tag anywhere in the program (catches exported/cross-file components).
 *
 * Both paths are sound (zero false positives); type information is purely additive — it finds more
 * real components, never flips a verdict on correct code. The trade-off is a tolerated false
 * negative: an unannotated component used only in another file is not seen without type info.
 *
 * The module owns its own whole-file index and reads `typescriptEnabled` from `context`, so a
 * caller needs nothing but the node — no `jsxComponentNames` set to build, thread, or defer. The
 * index is complete on first query (see {@link getInFileComponentVariables}), so this is correct
 * when called inline during traversal.
 */
export function isComponent(node: FunctionNode, context: SolidRuleContext): boolean {
  if (hasSolidComponentTypeAnnotation(node, context)) {
    return true;
  }

  const name = getFunctionName(node);
  if (name != null) {
    // Match by binding: the function's own variable must be the one a `<C/>` tag references — a
    // same-named local helper resolves to a different variable and is not conflated with it.
    const fnVariable = ASTUtils.findVariable(context.sourceCode.getScope(node), name);
    if (fnVariable != null && getInFileComponentVariables(context.sourceCode).has(fnVariable)) {
      return true;
    }
  }

  const typescriptEnabled = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled;
  if (typescriptEnabled) {
    const services = getTypeAwareServices(context);
    if (services) {
      const symbol = getFunctionSymbol(node, services);
      if (
        symbol &&
        getJsxTagSymbols(services).has(resolveAlias(symbol, services.program.getTypeChecker()))
      ) {
        return true;
      }
    }
  }

  return false;
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
export function bindsToSolid(
  identifier: T.Identifier,
  context: SolidRuleContext,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return resolveSolidCallee(identifier, context, canonicalNames) != null;
}

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
    node.parent.callee.type === "Identifier" &&
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
export function resolveSolidCallee(
  node: T.Node,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  canonicalNames: ReadonlySet<string>,
): string | null {
  if (node.type !== "Identifier") {
    return null;
  }

  const traced = trace(node, context);
  if (traced.type === "Identifier" && canonicalNames.has(traced.name)) {
    // A bare canonical name is the Solid API only when it is a *truly unresolved* global
    // (auto-import). `trace` also returns the identifier unchanged when it binds to a local the
    // tracer can't follow — a `let`, a parameter, or a destructured `const { onCleanup } = lib` —
    // and those are the user's own bindings, not Solid (ADR-0003). Distinguish by binding existence.
    const variable = ASTUtils.findVariable(context.sourceCode.getScope(traced), traced);
    return variable == null || variable.defs.length === 0 ? traced.name : null;
  }

  if (traced.type === "ImportSpecifier" && isSolidJsImportDeclaration(traced.parent)) {
    const importedName =
      traced.imported.type === "Identifier" ? traced.imported.name : traced.imported.value;
    if (canonicalNames.has(importedName)) {
      return importedName;
    }
  }

  return null;
}

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
