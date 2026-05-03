import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import {
  collectSolidAliases,
  getNearestFunctionAncestor,
  isCallbackArgumentOf,
  matchesSolidName,
} from "./solid-rule-utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const FORBIDDEN_SCOPE_NAMES = new Set(["createTrackedEffect", "onSettled"]);
const FLUSH_NAMES = new Set(["flush"]);

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow flush() inside createTrackedEffect and onSettled in Solid 2.",
    },
    schema: [],
    messages: {
      noFlushInForbiddenScope:
        "Cannot call `flush()` from inside `createTrackedEffect` or `onSettled`; schedule work outside instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const forbiddenScopeAliases = new Set<string>();
    const flushAliases = new Set<string>();
    const forbiddenStack: T.FunctionLike[] = [];

    const onFunctionEnter = (node: T.FunctionLike) => {
      if (
        (node.type === "FunctionDeclaration" ||
          node.type === "FunctionExpression" ||
          node.type === "ArrowFunctionExpression") &&
        isCallbackArgumentOf(node, 0, forbiddenScopeAliases, FORBIDDEN_SCOPE_NAMES)
      ) {
        forbiddenStack.push(node);
      }
    };

    const onFunctionExit = (node: T.FunctionLike) => {
      if (forbiddenStack[forbiddenStack.length - 1] === node) {
        forbiddenStack.pop();
      }
    };

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, FORBIDDEN_SCOPE_NAMES, forbiddenScopeAliases);
        collectSolidAliases(node, FLUSH_NAMES, flushAliases);
      },
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      CallExpression(node) {
        const currentForbidden = forbiddenStack[forbiddenStack.length - 1];
        if (
          currentForbidden &&
          getNearestFunctionAncestor(node) === currentForbidden &&
          node.callee.type === "Identifier" &&
          matchesSolidName(node.callee.name, flushAliases, FLUSH_NAMES)
        ) {
          context.report({
            node: node.callee,
            messageId: "noFlushInForbiddenScope",
          });
        }
      },
    };
  },
});
