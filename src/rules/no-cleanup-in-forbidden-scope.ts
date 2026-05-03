import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import {
  collectSolidAliases,
  getNearestFunctionAncestor,
  isCallbackArgumentOf,
} from "./solid-rule-utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const FORBIDDEN_SCOPE_NAMES = new Set(["createTrackedEffect", "onSettled"]);
const ON_CLEANUP_NAMES = new Set(["onCleanup"]);

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow onCleanup inside createTrackedEffect and onSettled in Solid 2.",
    },
    schema: [],
    messages: {
      noCleanupInForbiddenScope:
        "Cannot use `onCleanup` inside `createTrackedEffect` or `onSettled`; return a cleanup function instead.",
    },
  },
  defaultOptions: [],
  create(context) {
    const onCleanupAliases = new Set<string>();
    const forbiddenScopeAliases = new Set<string>();
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
        collectSolidAliases(node, ON_CLEANUP_NAMES, onCleanupAliases);
        collectSolidAliases(node, FORBIDDEN_SCOPE_NAMES, forbiddenScopeAliases);
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
          (onCleanupAliases.has(node.callee.name) || ON_CLEANUP_NAMES.has(node.callee.name))
        ) {
          context.report({
            node: node.callee,
            messageId: "noCleanupInForbiddenScope",
          });
        }
      },
    };
  },
});
