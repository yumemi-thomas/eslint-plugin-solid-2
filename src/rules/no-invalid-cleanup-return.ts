import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import {
  collectSolidAliases,
  getPropertyName,
  getReturnedExpressions,
  matchesSolidName,
} from "./solid-rule-utils.js";
import { trace } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const APPLY_SCOPE_NAMES = new Set(["createEffect", "createRenderEffect"]);
const CLEANUP_SCOPE_NAMES = new Set(["createTrackedEffect", "onSettled"]);

// Conservative: only true when the expression cannot possibly be a function or `undefined`.
// CallExpression, AwaitExpression, MemberExpression, etc. could yield either, so they're
// excluded — flagging them would need type info.
function isDefinitelyInvalidCleanupReturn(node: T.Expression | null): boolean {
  if (node == null) {
    return false;
  }

  switch (node.type) {
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return false;
    case "Identifier":
      return false;
    case "ConditionalExpression":
      return (
        isDefinitelyInvalidCleanupReturn(node.consequent) ||
        isDefinitelyInvalidCleanupReturn(node.alternate)
      );
    case "Literal":
      return node.value !== undefined;
    case "ObjectExpression":
    case "ArrayExpression":
    case "TemplateLiteral":
    case "BinaryExpression":
    case "UnaryExpression":
    case "UpdateExpression":
    case "NewExpression":
    case "JSXElement":
    case "JSXFragment":
      return true;
    default:
      return false;
  }
}

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow obviously invalid cleanup return values from Solid 2 effect/onSettled callbacks.",
    },
    schema: [],
    messages: {
      noInvalidCleanupReturn:
        "{{name}} callback must return a cleanup function or `undefined` in Solid 2.",
    },
  },
  defaultOptions: [],
  create(context) {
    const applyAliases = new Set<string>();
    const cleanupAliases = new Set<string>();

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

    const getApplyCallbacks = (
      value: T.Node | null | undefined,
    ): Array<T.FunctionExpression | T.ArrowFunctionExpression> => {
      const direct = getFunctionValue(value);
      if (direct) {
        return [direct];
      }

      if (value?.type !== "ObjectExpression") {
        return [];
      }

      return value.properties.flatMap((property) => {
        if (property.type !== "Property" || getPropertyName(property) !== "effect") {
          return [];
        }

        const effect = getFunctionValue(property.value);
        return effect ? [effect] : [];
      });
    };

    const check = (node: T.FunctionExpression | T.ArrowFunctionExpression, name: string) => {
      for (const returned of getReturnedExpressions(node)) {
        if (!isDefinitelyInvalidCleanupReturn(returned)) {
          continue;
        }

        context.report({
          node: returned ?? node,
          messageId: "noInvalidCleanupReturn",
          data: { name },
        });
      }
    };

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, APPLY_SCOPE_NAMES, applyAliases);
        collectSolidAliases(node, CLEANUP_SCOPE_NAMES, cleanupAliases);
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }

        if (matchesSolidName(node.callee.name, applyAliases, APPLY_SCOPE_NAMES)) {
          for (const callback of getApplyCallbacks(node.arguments[1])) {
            check(callback, node.callee.name);
          }
          return;
        }

        if (matchesSolidName(node.callee.name, cleanupAliases, CLEANUP_SCOPE_NAMES)) {
          const callback = getFunctionValue(node.arguments[0]);
          if (callback) {
            check(callback, node.callee.name);
          }
        }
      },
    };
  },
});
