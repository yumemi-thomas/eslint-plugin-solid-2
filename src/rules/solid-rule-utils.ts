import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, trace, type FunctionNode } from "../utils.js";

export function collectSolidAliases(
  node: T.ImportDeclaration,
  canonicalNames: ReadonlySet<string>,
  aliases: Set<string>,
): void {
  if (node.source.type !== "Literal" || node.source.value !== "solid-js") {
    return;
  }

  for (const specifier of node.specifiers) {
    if (specifier.type !== "ImportSpecifier") {
      continue;
    }

    const importedName =
      specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value;
    if (canonicalNames.has(importedName)) {
      aliases.add(specifier.local.name);
    }
  }
}

export function matchesSolidName(
  name: string,
  aliases: ReadonlySet<string>,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return aliases.has(name) || canonicalNames.has(name);
}

export function isCallbackArgumentOf(
  node: FunctionNode,
  argumentIndex: number,
  aliases: ReadonlySet<string>,
  canonicalNames: ReadonlySet<string>,
): boolean {
  return (
    node.parent?.type === "CallExpression" &&
    node.parent.arguments[argumentIndex] === node &&
    node.parent.callee.type === "Identifier" &&
    matchesSolidName(node.parent.callee.name, aliases, canonicalNames)
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

export function resolveSolidCallee(
  node: T.Node,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  aliases: ReadonlySet<string>,
  canonicalNames: ReadonlySet<string>,
): string | null {
  if (node.type !== "Identifier") {
    return null;
  }

  if (matchesSolidName(node.name, aliases, canonicalNames)) {
    return node.name;
  }

  const traced = trace(node, context);
  if (traced.type === "Identifier" && canonicalNames.has(traced.name)) {
    return traced.name;
  }

  if (
    traced.type === "ImportSpecifier" &&
    traced.parent?.type === "ImportDeclaration" &&
    traced.parent.source.type === "Literal" &&
    traced.parent.source.value === "solid-js"
  ) {
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
