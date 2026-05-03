import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import {
  collectSolidAliases,
  getPropertyName,
  getReturnedExpressions,
  resolveSolidCallee,
} from "./solid-rule-utils.js";
import { trace } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const EFFECT_NAMES = new Set(["createEffect", "createRenderEffect"]);
const STORE_FACTORIES = new Set(["createOptimisticStore", "createStore"]);
const SAFE_HELPERS = new Set(["deep", "snapshot"]);

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing store proxies through effect compute functions and reading them in the apply callback.",
    },
    schema: [],
    messages: {
      noStoreProxyInEffectApply:
        "Effect apply callbacks run untracked in Solid 2. Extract store properties in the compute phase or use `deep()` before reading them here.",
    },
  },
  defaultOptions: [],
  create(context) {
    const effectAliases = new Set<string>();
    const storeAliases = new Set<string>();
    const helperAliases = new Set<string>();
    const storeVars = new Set<TSESLint.Scope.Variable>();
    const sourceCode = context.sourceCode;

    const getFunctionValue = (
      value: T.Node | null | undefined,
    ): T.FunctionExpression | T.ArrowFunctionExpression | null => {
      if (value == null || value.type === "SpreadElement") {
        return null;
      }

      if (value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression") {
        return value;
      }

      const traced = trace(value, context);
      return traced.type === "FunctionExpression" || traced.type === "ArrowFunctionExpression"
        ? traced
        : null;
    };

    const getApplyCallback = (
      value: T.Node | null | undefined,
    ): T.FunctionExpression | T.ArrowFunctionExpression | null => {
      const direct = getFunctionValue(value);
      if (direct) {
        return direct;
      }

      if (value?.type !== "ObjectExpression") {
        return null;
      }

      for (const property of value.properties) {
        if (property.type !== "Property" || getPropertyName(property) !== "effect") {
          continue;
        }

        const effect = getFunctionValue(property.value);
        if (effect) {
          return effect;
        }
      }

      return null;
    };

    const isStoreSourceExpression = (node: T.Expression | null): boolean => {
      if (node == null) {
        return false;
      }

      if (
        node.type === "CallExpression" &&
        resolveSolidCallee(node.callee, context, helperAliases, SAFE_HELPERS) != null
      ) {
        return false;
      }

      if (node.type === "Identifier") {
        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
        return variable != null && storeVars.has(variable);
      }

      if (node.type === "MemberExpression") {
        let root: T.Expression = node.object;
        while (root.type === "MemberExpression") {
          root = root.object;
        }
        if (root.type === "Identifier") {
          const variable = ASTUtils.findVariable(sourceCode.getScope(root), root);
          return variable != null && storeVars.has(variable);
        }
      }

      return false;
    };

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, EFFECT_NAMES, effectAliases);
        collectSolidAliases(node, STORE_FACTORIES, storeAliases);
        collectSolidAliases(node, SAFE_HELPERS, helperAliases);
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "ArrayPattern" &&
          node.init?.type === "CallExpression" &&
          resolveSolidCallee(node.init.callee, context, storeAliases, STORE_FACTORIES) != null
        ) {
          const first = node.id.elements[0];
          if (first?.type === "Identifier") {
            const variable = sourceCode.scopeManager
              ?.getDeclaredVariables(node)
              .find((declared) => declared.name === first.name);
            if (variable) {
              storeVars.add(variable);
            }
          }
        }
      },
      CallExpression(node) {
        if (
          resolveSolidCallee(node.callee, context, effectAliases, EFFECT_NAMES) == null ||
          node.arguments.length < 2
        ) {
          return;
        }

        const compute = getFunctionValue(node.arguments[0]);
        const apply = getApplyCallback(node.arguments[1]);
        if (!compute || !apply) {
          return;
        }

        const returned = getReturnedExpressions(compute).filter(
          (value): value is T.Expression => value != null,
        );
        if (returned.length === 0) {
          return;
        }

        if (
          !returned.some((value) => isStoreSourceExpression(value)) ||
          apply.params.length === 0
        ) {
          return;
        }

        const applyParam = apply.params[0];
        if (applyParam.type !== "Identifier") {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(applyParam), applyParam);
        if (!variable) {
          return;
        }

        for (const reference of variable.references) {
          const identifier = reference.identifier;
          if (reference.init) {
            continue;
          }

          if (
            identifier.parent?.type === "VariableDeclarator" &&
            identifier.parent.init === identifier &&
            (identifier.parent.id.type === "ObjectPattern" ||
              identifier.parent.id.type === "ArrayPattern")
          ) {
            context.report({
              node: identifier.parent,
              messageId: "noStoreProxyInEffectApply",
            });
            break;
          }

          if (identifier.parent?.type === "SpreadElement") {
            context.report({
              node: identifier.parent,
              messageId: "noStoreProxyInEffectApply",
            });
            break;
          }

          if (
            identifier.parent?.type === "MemberExpression" &&
            identifier.parent.object === identifier
          ) {
            context.report({
              node: identifier.parent,
              messageId: "noStoreProxyInEffectApply",
            });
            break;
          }
        }
      },
    };
  },
});
