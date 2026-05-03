import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, type FunctionNode } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const SINGLE_ACCESSOR_FACTORIES = new Set(["createMemo", "createProjection"]);
// `createStore`'s function-form is intentionally left out: its accessor is a proxy read via
// member expressions, not a callable, so the JSX-read detection below does not apply.
const PAIR_ACCESSOR_FACTORIES = new Set(["createSignal"]);

function isPromiseMemberCallee(callee: T.Expression | T.Super): boolean {
  if (callee.type !== "MemberExpression" || callee.computed) {
    return false;
  }

  if (callee.property.type !== "Identifier") {
    return false;
  }

  if (
    callee.property.name === "then" ||
    callee.property.name === "catch" ||
    callee.property.name === "finally"
  ) {
    return true;
  }

  if (
    callee.object.type === "Identifier" &&
    callee.object.name === "Promise" &&
    new Set(["resolve", "reject", "all", "allSettled", "race", "any"]).has(callee.property.name)
  ) {
    return true;
  }

  return false;
}

function expressionLooksAsync(node: T.Expression | null | undefined): boolean {
  if (node == null) {
    return false;
  }

  switch (node.type) {
    case "AwaitExpression":
      return true;
    case "NewExpression":
      return node.callee.type === "Identifier" && node.callee.name === "Promise";
    case "CallExpression":
      return isPromiseMemberCallee(node.callee);
    case "ConditionalExpression":
      return expressionLooksAsync(node.consequent) || expressionLooksAsync(node.alternate);
    case "LogicalExpression":
      return expressionLooksAsync(node.left) || expressionLooksAsync(node.right);
    case "SequenceExpression":
      return expressionLooksAsync(node.expressions.at(-1));
    case "ChainExpression":
      return expressionLooksAsync(node.expression);
    default:
      return false;
  }
}

function blockHasAsyncReturn(block: T.BlockStatement): boolean {
  const statements: T.Statement[] = [...block.body];
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
      case "DoWhileStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "ForStatement":
      case "WhileStatement":
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
        if (expressionLooksAsync(statement.argument)) {
          return true;
        }
        break;
      case "ExpressionStatement":
        // `await foo();` as a top-level statement still makes the function async.
        if (
          statement.expression.type === "AwaitExpression" ||
          (statement.expression.type === "CallExpression" &&
            isPromiseMemberCallee(statement.expression.callee))
        ) {
          return true;
        }
        break;
      default:
        break;
    }
  }

  return false;
}

function looksLikeAsyncCompute(node: FunctionNode): boolean {
  if (node.async) {
    return true;
  }

  if (node.body.type !== "BlockStatement") {
    return expressionLooksAsync(node.body);
  }

  return blockHasAsyncReturn(node.body);
}

function getJSXElementName(node: T.JSXElement): string | null {
  const name = node.openingElement.name;
  return name.type === "JSXIdentifier" ? name.name : null;
}

function isDirectlyInJSX(node: T.Node): boolean {
  let current: T.Node | undefined = node.parent;
  while (current != null) {
    if (current.type === "JSXExpressionContainer" || current.type === "JSXSpreadAttribute") {
      return true;
    }
    if (isFunctionNode(current)) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

function hasLoadingAncestor(node: T.Node, loadingNames: ReadonlySet<string>): boolean {
  let current: T.Node | undefined = node.parent;
  while (current != null) {
    if (current.type === "JSXElement") {
      const name = getJSXElementName(current);
      if (name != null && loadingNames.has(name)) {
        return true;
      }
    }
    if (isFunctionNode(current)) {
      // Don't stop at JSX callbacks (e.g. For/Show children) — a <Loading> outside still applies.
      if (
        current.parent?.type !== "JSXExpressionContainer" &&
        current.parent?.type !== "JSXSpreadAttribute"
      ) {
        return false;
      }
    }
    current = current.parent;
  }
  return false;
}

export default createRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when async computations are read in JSX without a <Loading> boundary (ASYNC_OUTSIDE_LOADING_BOUNDARY).",
    },
    schema: [],
    messages: {
      asyncOutsideLoadingBoundary:
        "'{{name}}' is an async computation. Reading it in JSX without a <Loading> boundary will trigger ASYNC_OUTSIDE_LOADING_BOUNDARY and defer the root mount. Wrap with <Loading fallback={...}> for explicit fallback UI.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const singleAccessorAliases = new Set<string>();
    const pairAccessorAliases = new Set<string>();
    const loadingNames = new Set<string>(["Loading"]);
    const asyncAccessorVars = new Set<TSESLint.Scope.Variable>();

    const matchesFactory = (
      name: string,
      canonical: ReadonlySet<string>,
      aliases: ReadonlySet<string>,
    ) => canonical.has(name) || aliases.has(name);

    return {
      ImportDeclaration(node) {
        if (node.source.type !== "Literal") {
          return;
        }

        const source = node.source.value;

        if (source === "solid-js") {
          for (const specifier of node.specifiers) {
            if (specifier.type !== "ImportSpecifier") {
              continue;
            }
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value;
            if (SINGLE_ACCESSOR_FACTORIES.has(importedName)) {
              singleAccessorAliases.add(specifier.local.name);
            }
            if (PAIR_ACCESSOR_FACTORIES.has(importedName)) {
              pairAccessorAliases.add(specifier.local.name);
            }
          }
        }

        if (source === "@solidjs/web") {
          for (const specifier of node.specifiers) {
            if (specifier.type !== "ImportSpecifier") {
              continue;
            }
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value;
            if (importedName === "Loading") {
              loadingNames.add(specifier.local.name);
            }
          }
        }
      },
      VariableDeclarator(node) {
        if (node.init?.type !== "CallExpression" || node.init.callee.type !== "Identifier") {
          return;
        }

        const calleeName = node.init.callee.name;
        const firstArg = node.init.arguments[0];
        if (!firstArg || firstArg.type === "SpreadElement" || !isFunctionNode(firstArg)) {
          return;
        }

        if (!looksLikeAsyncCompute(firstArg)) {
          return;
        }

        let accessorIdentifier: T.Identifier | null = null;

        if (
          node.id.type === "Identifier" &&
          matchesFactory(calleeName, SINGLE_ACCESSOR_FACTORIES, singleAccessorAliases)
        ) {
          accessorIdentifier = node.id;
        } else if (
          node.id.type === "ArrayPattern" &&
          matchesFactory(calleeName, PAIR_ACCESSOR_FACTORIES, pairAccessorAliases)
        ) {
          const first = node.id.elements[0];
          if (first?.type === "Identifier") {
            accessorIdentifier = first;
          }
        }

        if (!accessorIdentifier) {
          return;
        }

        const variable = ASTUtils.findVariable(
          sourceCode.getScope(accessorIdentifier),
          accessorIdentifier,
        );
        if (variable) {
          asyncAccessorVars.add(variable);
        }
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
        if (!variable || !asyncAccessorVars.has(variable)) {
          return;
        }

        if (!isDirectlyInJSX(node)) {
          return;
        }

        if (hasLoadingAncestor(node, loadingNames)) {
          return;
        }

        context.report({
          node,
          messageId: "asyncOutsideLoadingBoundary",
          data: { name: node.callee.name },
        });
      },
    };
  },
});
