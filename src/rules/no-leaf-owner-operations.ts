import { TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, trace } from "../utils.js";
import { createRule } from "./create-rule.js";
import {
  bindsToSolid,
  getNearestFunctionAncestor,
  isComponent,
  isSolidApiCallbackArgument,
} from "./solid-rule-utils.js";

// Leaf owners: they cannot own or schedule, so `onCleanup`, reactive-primitive creation, and
// `flush()` are all forbidden directly inside their callback. These are three facets of one
// runtime constraint — see docs/adr/0006.
const TRACKED_EFFECT_NAMES = new Set(["createTrackedEffect"]);
const ON_SETTLED_NAMES = new Set(["onSettled"]);
const OWNER_CALLBACK_NAMES = new Set([
  "createEffect",
  "createMemo",
  "createRenderEffect",
  "createRoot",
]);
const ON_CLEANUP_NAMES = new Set(["onCleanup"]);
const FLUSH_NAMES = new Set(["flush"]);
const PRIMITIVE_NAMES = new Set([
  "createEffect",
  "createErrorBoundary",
  "createLoadingBoundary",
  "createMemo",
  "createOwner",
  "createProjection",
  "createRenderEffect",
  "createRevealOrder",
  "createRoot",
  "createTrackedEffect",
  "mapArray",
  "repeat",
]);
const FUNCTION_FORM_PRIMITIVE_NAMES = new Set([
  "createOptimistic",
  "createOptimisticStore",
  "createSignal",
  "createStore",
]);

function hasProvablyFunctionFirstArgument(
  node: T.CallExpression,
  context: Parameters<typeof trace>[1],
): boolean {
  const first = node.arguments[0];
  if (first == null || first.type === "SpreadElement") {
    return false;
  }
  return isFunctionNode(first) || isFunctionNode(trace(first, context));
}

type MessageIds = "noCleanup" | "noFlush" | "noPrimitives";

export default createRule<[], MessageIds>({
  name: "no-leaf-owner-operations",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow onCleanup, reactive-primitive creation, and flush() inside the leaf owners createTrackedEffect and onSettled.",
    },
    schema: [],
    messages: {
      noCleanup:
        "Cannot use `onCleanup` inside `createTrackedEffect` or `onSettled`; return a cleanup function instead.",
      noFlush:
        "Cannot call `flush()` from inside `createTrackedEffect` or `onSettled`; schedule work outside instead.",
      noPrimitives:
        "Cannot create reactive primitives inside `createTrackedEffect` or `onSettled`; move them to the component body or another owner.",
    },
  },
  defaultOptions: [],
  create(context) {
    const forbiddenStack: T.FunctionLike[] = [];

    const onFunctionEnter = (node: T.FunctionLike) => {
      if (
        node.type !== "FunctionDeclaration" &&
        node.type !== "FunctionExpression" &&
        node.type !== "ArrowFunctionExpression"
      ) {
        return;
      }

      const trackedEffect = isSolidApiCallbackArgument(node, 0, context, TRACKED_EFFECT_NAMES);
      let ownerBackedSettled = false;
      if (isSolidApiCallbackArgument(node, 0, context, ON_SETTLED_NAMES)) {
        const settledCall = node.parent as T.CallExpression;
        const enclosing = getNearestFunctionAncestor(settledCall);
        ownerBackedSettled =
          enclosing != null &&
          (isComponent(enclosing, context) ||
            isSolidApiCallbackArgument(enclosing, 0, context, OWNER_CALLBACK_NAMES) ||
            isSolidApiCallbackArgument(enclosing, 1, context, OWNER_CALLBACK_NAMES));
      }

      if (trackedEffect || ownerBackedSettled) {
        forbiddenStack.push(node);
      }
    };

    const onFunctionExit = (node: T.FunctionLike) => {
      if (forbiddenStack[forbiddenStack.length - 1] === node) {
        forbiddenStack.pop();
      }
    };

    return {
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      CallExpression(node) {
        const currentForbidden = forbiddenStack[forbiddenStack.length - 1];
        if (
          !currentForbidden ||
          getNearestFunctionAncestor(node) !== currentForbidden ||
          node.callee.type !== "Identifier"
        ) {
          return;
        }

        const callee = node.callee;
        if (bindsToSolid(callee, context, ON_CLEANUP_NAMES)) {
          context.report({ node: callee, messageId: "noCleanup" });
        } else if (bindsToSolid(callee, context, FLUSH_NAMES)) {
          context.report({ node: callee, messageId: "noFlush" });
        } else if (bindsToSolid(callee, context, PRIMITIVE_NAMES)) {
          context.report({ node: callee, messageId: "noPrimitives" });
        } else if (
          bindsToSolid(callee, context, FUNCTION_FORM_PRIMITIVE_NAMES) &&
          hasProvablyFunctionFirstArgument(node, context)
        ) {
          context.report({ node: callee, messageId: "noPrimitives" });
        }
      },
    };
  },
});
