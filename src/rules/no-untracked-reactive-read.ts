import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { collectSolidAliases, matchesSolidName } from "./solid-rule-utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const ACCESSOR_FACTORIES = new Set(["createMemo", "createProjection"]);
const PAIR_ACCESSOR_FACTORIES = new Set(["createOptimistic", "createSignal"]);
const STORE_FACTORIES = new Set(["createOptimisticStore", "createStore"]);
// Reads inside the first-arg callback of these scopes are exempt: tracked compute scopes
// already observe them, and `untrack` explicitly opts out.
const SAFE_READ_SCOPES = new Set(["createEffect", "createMemo", "createRenderEffect", "untrack"]);
const CONTROL_FLOW_COMPONENTS = new Set(["For", "Match", "Show"]);

type ReactiveKind = "accessor" | "props" | "store";

interface StrictScopeInfo {
  node: FunctionNode;
}

type FunctionNode = T.FunctionDeclaration | T.FunctionExpression | T.ArrowFunctionExpression;

function isFunctionNode(node: T.Node | null | undefined): node is FunctionNode {
  return (
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression" ||
    node?.type === "ArrowFunctionExpression"
  );
}

function getFunctionName(node: FunctionNode): string | null {
  if (
    (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") &&
    node.id != null
  ) {
    return node.id.name;
  }

  if (node.parent?.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    return node.parent.id.name;
  }

  return null;
}

function expressionCanYieldJSX(node: T.Expression | null | undefined): boolean {
  if (node == null) {
    return false;
  }

  switch (node.type) {
    case "JSXElement":
    case "JSXFragment":
      return true;
    case "ConditionalExpression":
      return expressionCanYieldJSX(node.consequent) || expressionCanYieldJSX(node.alternate);
    case "LogicalExpression":
      return expressionCanYieldJSX(node.left) || expressionCanYieldJSX(node.right);
    case "SequenceExpression":
      return expressionCanYieldJSX(node.expressions.at(-1));
    default:
      return false;
  }
}

function blockReturnsJSX(block: T.BlockStatement): boolean {
  const statements = [...block.body];
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
        if (expressionCanYieldJSX(statement.argument)) {
          return true;
        }
        break;
      default:
        break;
    }
  }

  return false;
}

function returnsJSX(node: FunctionNode): boolean {
  if (node.body.type !== "BlockStatement") {
    return expressionCanYieldJSX(node.body);
  }

  return blockReturnsJSX(node.body);
}

function isComponentLike(node: FunctionNode): boolean {
  if (node.parent?.type === "JSXExpressionContainer") {
    return false;
  }

  const name = getFunctionName(node);
  return returnsJSX(node) && (name == null || !/^[a-z]/.test(name));
}

function getJSXTagName(node: T.JSXElement): string | null {
  const name = node.openingElement.name;
  return name.type === "JSXIdentifier" ? name.name : null;
}

function isControlFlowCallback(
  node: FunctionNode,
  controlFlowAliases: ReadonlySet<string>,
): boolean {
  return (
    node.parent?.type === "JSXExpressionContainer" &&
    node.parent.parent?.type === "JSXElement" &&
    (() => {
      const tag = getJSXTagName(node.parent.parent);
      return tag != null && (CONTROL_FLOW_COMPONENTS.has(tag) || controlFlowAliases.has(tag));
    })()
  );
}

function getNearestFunctionAncestor(node: T.Node): FunctionNode | null {
  let current = node.parent;
  while (current != null) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

function isInsideSafeReadScope(node: T.Node, safeReadScopeAliases: ReadonlySet<string>): boolean {
  let current = node.parent;
  while (current != null) {
    if (isFunctionNode(current)) {
      const parent = current.parent;
      if (
        parent?.type === "CallExpression" &&
        parent.arguments[0] === current &&
        parent.callee.type === "Identifier" &&
        matchesSolidName(parent.callee.name, safeReadScopeAliases, SAFE_READ_SCOPES)
      ) {
        return true;
      }
    }
    current = current.parent;
  }

  return false;
}

function isInsideJSXRead(node: T.Node, scopeNode: FunctionNode): boolean {
  let current: T.Node | undefined = node;
  while (current != null && current !== scopeNode) {
    if (current.type === "JSXExpressionContainer" || current.type === "JSXSpreadAttribute") {
      return true;
    }
    current = current.parent ?? undefined;
  }

  return false;
}

function getOutermostMemberExpression(node: T.MemberExpression): T.MemberExpression {
  let current = node;
  while (current.parent?.type === "MemberExpression" && current.parent.object === current) {
    current = current.parent;
  }

  return current;
}

function getMemberRoot(node: T.MemberExpression): T.Expression {
  let current: T.Expression = node.object;
  while (current.type === "MemberExpression") {
    current = current.object;
  }

  return current;
}

function getReactiveReadNode(node: T.MemberExpression): T.Node | null {
  const outermost = getOutermostMemberExpression(node);
  return outermost.parent?.type === "ChainExpression" ? outermost.parent : outermost;
}

function reportName(node: T.Node, sourceCode: TSESLint.SourceCode): string {
  return sourceCode.getText(node);
}

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow untracked reactive reads in Solid 2 component bodies and control-flow callback bodies.",
    },
    schema: [],
    messages: {
      noUntrackedReactiveRead:
        "Reactive read '{{name}}' will not update here in Solid 2. Move it into JSX, a reactive scope like `createMemo`/`createEffect`, or wrap it in `untrack(...)`.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const accessorAliases = new Set<string>();
    const pairAccessorAliases = new Set<string>();
    const storeAliases = new Set<string>();
    const safeReadScopeAliases = new Set<string>();
    const controlFlowAliases = new Set<string>();
    const reactiveVars = new Map<TSESLint.Scope.Variable, ReactiveKind>();
    const strictScopes: StrictScopeInfo[] = [];

    const currentStrictScope = () => strictScopes[strictScopes.length - 1];

    const reportIfNeeded = (node: T.Node) => {
      const scope = currentStrictScope();
      if (!scope) {
        return;
      }

      if (getNearestFunctionAncestor(node) !== scope.node) {
        return;
      }

      if (isInsideSafeReadScope(node, safeReadScopeAliases) || isInsideJSXRead(node, scope.node)) {
        return;
      }

      context.report({
        node,
        messageId: "noUntrackedReactiveRead",
        data: { name: reportName(node, sourceCode) },
      });
    };

    const registerParam = (identifier: T.Identifier, kind: ReactiveKind) => {
      const variable = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier);
      if (variable) {
        reactiveVars.set(variable, kind);
      }
    };

    const onFunctionEnter = (node: FunctionNode) => {
      if (isComponentLike(node)) {
        strictScopes.push({ node });
        const param = node.params[0];
        if (param?.type === "Identifier") {
          registerParam(param, "props");
        }
        return;
      }

      if (isControlFlowCallback(node, controlFlowAliases)) {
        strictScopes.push({ node });
        for (const param of node.params) {
          if (param.type === "Identifier") {
            registerParam(param, "accessor");
          }
        }
      }
    };

    const onFunctionExit = (node: FunctionNode) => {
      if (currentStrictScope()?.node === node) {
        strictScopes.pop();
      }
    };

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, ACCESSOR_FACTORIES, accessorAliases);
        collectSolidAliases(node, PAIR_ACCESSOR_FACTORIES, pairAccessorAliases);
        collectSolidAliases(node, STORE_FACTORIES, storeAliases);
        collectSolidAliases(node, SAFE_READ_SCOPES, safeReadScopeAliases);
        collectSolidAliases(node, CONTROL_FLOW_COMPONENTS, controlFlowAliases);
      },
      VariableDeclarator(node) {
        if (node.id.type === "Identifier" && node.init?.type === "CallExpression") {
          if (
            node.init.callee.type === "Identifier" &&
            matchesSolidName(node.init.callee.name, accessorAliases, ACCESSOR_FACTORIES)
          ) {
            const variable = ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
            if (variable) {
              reactiveVars.set(variable, "accessor");
            }
          }
          return;
        }

        if (
          node.id.type === "ArrayPattern" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier"
        ) {
          if (
            matchesSolidName(node.init.callee.name, pairAccessorAliases, PAIR_ACCESSOR_FACTORIES)
          ) {
            const first = node.id.elements[0];
            if (first?.type === "Identifier") {
              const variable = sourceCode.scopeManager
                ?.getDeclaredVariables(node)
                .find((declared) => declared.name === first.name);
              if (variable) {
                reactiveVars.set(variable, "accessor");
              }
            }
          }

          if (matchesSolidName(node.init.callee.name, storeAliases, STORE_FACTORIES)) {
            const first = node.id.elements[0];
            if (first?.type === "Identifier") {
              const variable = sourceCode.scopeManager
                ?.getDeclaredVariables(node)
                .find((declared) => declared.name === first.name);
              if (variable) {
                reactiveVars.set(variable, "store");
              }
            }
          }
        }

        if (
          strictScopes.length > 0 &&
          (node.id.type === "ObjectPattern" || node.id.type === "ArrayPattern") &&
          node.init != null
        ) {
          if (node.init.type === "Identifier") {
            const variable = ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
            if (variable && reactiveVars.has(variable)) {
              reportIfNeeded(node.init);
            }
          } else if (
            node.init.type === "CallExpression" &&
            node.init.callee.type === "Identifier"
          ) {
            const variable = ASTUtils.findVariable(
              sourceCode.getScope(node.init),
              node.init.callee,
            );
            if (variable && reactiveVars.get(variable) === "accessor") {
              reportIfNeeded(node.init);
            }
          } else if (node.init.type === "MemberExpression") {
            const root = getMemberRoot(node.init);
            if (root.type === "Identifier") {
              const variable = ASTUtils.findVariable(sourceCode.getScope(root), root);
              if (
                variable &&
                (reactiveVars.get(variable) === "props" || reactiveVars.get(variable) === "store")
              ) {
                reportIfNeeded(getReactiveReadNode(node.init) ?? node.init);
              }
            }
          }
        }
      },
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      CallExpression(node) {
        if (strictScopes.length === 0 || node.callee.type !== "Identifier") {
          return;
        }

        if (node.parent?.type === "MemberExpression" && node.parent.object === node) {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
        if (variable && reactiveVars.get(variable) === "accessor") {
          reportIfNeeded(node.parent?.type === "ChainExpression" ? node.parent : node);
        }
      },
      MemberExpression(node) {
        if (strictScopes.length === 0) {
          return;
        }

        if (node.parent?.type === "MemberExpression" && node.parent.object === node) {
          return;
        }

        const root = getMemberRoot(node);
        if (root.type === "Identifier") {
          const variable = ASTUtils.findVariable(sourceCode.getScope(root), root);
          const kind = variable && reactiveVars.get(variable);
          if (kind === "props" || kind === "store") {
            reportIfNeeded(getReactiveReadNode(node) ?? node);
            return;
          }
        }

        if (root.type === "CallExpression" && root.callee.type === "Identifier") {
          const variable = ASTUtils.findVariable(sourceCode.getScope(root), root.callee);
          if (variable && reactiveVars.get(variable) === "accessor") {
            reportIfNeeded(getReactiveReadNode(node) ?? node);
          }
        }
      },
    };
  },
});
