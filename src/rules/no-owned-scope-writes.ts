import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import type { FunctionNode } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const SETTER_FACTORIES = new Set([
  "createOptimistic",
  "createOptimisticStore",
  "createSignal",
  "createStore",
]);
const EFFECT_FACTORIES = new Set(["createEffect", "createRenderEffect"]);
const COMPUTE_FACTORIES = new Set(["createEffect", "createMemo", "createRenderEffect"]);

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

function getPropertyName(node: T.Property): string | null {
  if (!node.computed && node.key.type === "Identifier") {
    return node.key.name;
  }

  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return node.key.value;
  }

  return null;
}

function hasOwnedWriteOption(node: T.CallExpression): boolean {
  const options = node.arguments[1];
  if (options?.type !== "ObjectExpression") {
    return false;
  }

  return options.properties.some(
    (property) =>
      property.type === "Property" &&
      getPropertyName(property) === "ownedWrite" &&
      property.value.type === "Literal" &&
      property.value.value === true,
  );
}

function blockReturnsJSX(block: T.BlockStatement): boolean {
  const statements = [...block.body];
  while (statements.length > 0) {
    const statement = statements.pop()!;
    switch (statement.type) {
      case "BlockStatement":
        statements.push(...statement.body);
        break;
      case "IfStatement":
        if (statement.consequent) {
          statements.push(statement.consequent);
        }
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

function getComponentName(node: FunctionNode): string | null {
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

function isComponentLike(node: FunctionNode): boolean {
  if (node.parent?.type === "JSXExpressionContainer") {
    return false;
  }

  const name = getComponentName(node);
  return returnsJSX(node) && (name == null || !/^[a-z]/.test(name));
}

function isOwnedScopeFunction(
  node: FunctionNode,
  computeAliases: ReadonlySet<string>,
  effectAliases: ReadonlySet<string>,
): boolean {
  if (isComponentLike(node)) {
    return true;
  }

  if (
    node.parent?.type !== "CallExpression" ||
    node.parent.arguments[0] !== node ||
    node.parent.callee.type !== "Identifier"
  ) {
    return false;
  }

  const callee = node.parent.callee.name;
  if (!computeAliases.has(callee) && !COMPUTE_FACTORIES.has(callee)) {
    return false;
  }

  // The 1.x single-arg createEffect/createRenderEffect is already marked deprecated.
  // Only flag the 2.0 split form (≥2 args) where the first arg is explicitly the compute phase.
  if (EFFECT_FACTORIES.has(callee) || effectAliases.has(callee)) {
    return node.parent.arguments.length >= 2;
  }

  return true;
}

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow signal/store writes inside component bodies and reactive compute scopes in Solid 2.",
    },
    schema: [],
    messages: {
      noOwnedScopeWrite:
        "Writing to state inside a component or reactive compute scope is not allowed in Solid 2. Derive values instead, move the write to an event handler or apply phase, or use `ownedWrite: true` for internal `createSignal` state.",
    },
  },
  defaultOptions: [],
  create(context) {
    const setterVariables = new Map<TSESLint.Scope.Variable, { allowOwnedWrite: boolean }>();
    const setterFactories = new Set<string>();
    const createSignalAliases = new Set<string>();
    const computeAliases = new Set<string>();
    const effectAliases = new Set<string>();
    const functionStack: Array<{ node: FunctionNode; forbidden: boolean }> = [];
    const sourceCode = context.sourceCode;

    const currentFunction = () => functionStack[functionStack.length - 1];

    const onFunctionEnter = (node: FunctionNode) => {
      functionStack.push({
        node,
        forbidden: isOwnedScopeFunction(node, computeAliases, effectAliases),
      });
    };

    const onFunctionExit = () => {
      functionStack.pop();
    };

    return {
      ImportDeclaration(node) {
        if (node.source.type !== "Literal" || node.source.value !== "solid-js") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          const importedName =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value;
          if (SETTER_FACTORIES.has(importedName)) {
            setterFactories.add(specifier.local.name);
          }
          if (importedName === "createSignal") {
            createSignalAliases.add(specifier.local.name);
          }
          if (COMPUTE_FACTORIES.has(importedName)) {
            computeAliases.add(specifier.local.name);
          }
          if (EFFECT_FACTORIES.has(importedName)) {
            effectAliases.add(specifier.local.name);
          }
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== "ArrayPattern" ||
          node.init?.type !== "CallExpression" ||
          node.init.callee.type !== "Identifier" ||
          (!setterFactories.has(node.init.callee.name) &&
            !SETTER_FACTORIES.has(node.init.callee.name))
        ) {
          return;
        }

        const setterElement = node.id.elements[1];
        if (setterElement?.type !== "Identifier") {
          return;
        }

        const variable = sourceCode.scopeManager
          ?.getDeclaredVariables(node)
          .find((declared) => declared.name === setterElement.name);
        if (!variable) {
          return;
        }

        setterVariables.set(variable, {
          allowOwnedWrite:
            (node.init.callee.name === "createSignal" ||
              createSignalAliases.has(node.init.callee.name)) &&
            hasOwnedWriteOption(node.init),
        });
      },
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      CallExpression(node) {
        const current = currentFunction();
        if (!current?.forbidden || node.callee.type !== "Identifier") {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
        const setter = variable && setterVariables.get(variable);
        if (!setter || setter.allowOwnedWrite) {
          return;
        }

        context.report({
          node: node.callee,
          messageId: "noOwnedScopeWrite",
        });
      },
    };
  },
});
