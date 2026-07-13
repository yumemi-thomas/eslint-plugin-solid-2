import { TSESTree as T } from "@typescript-eslint/utils";
import {
  getTypeAwareServices,
  resolveTypeAwareSolidCallee,
} from "../analysis/typescript-semantics.js";
import { isFunctionNode, trace, type FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { getNearestFunctionAncestor, isComponent, resolveSolidCallee } from "./solid-rule-utils.js";

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

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "noCleanup" | "noFlush" | "noPrimitives";

export default createRule<Options, MessageIds>({
  name: "no-leaf-owner-operations",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow onCleanup, reactive-primitive creation, and flush() inside the leaf owners createTrackedEffect and onSettled.",
    },
    schema: [
      {
        type: "object",
        properties: {
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noCleanup:
        "Cannot use `onCleanup` inside `createTrackedEffect` or `onSettled`; return a cleanup function instead.",
      noFlush:
        "Cannot call `flush()` from inside `createTrackedEffect` or `onSettled`; schedule work outside instead.",
      noPrimitives:
        "Cannot create reactive primitives inside `createTrackedEffect` or `onSettled`; move them to the component body or another owner.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const services = context.options[0]?.typescriptEnabled ? getTypeAwareServices(context) : null;
    const isSolidApi = (node: T.Node, names: ReadonlySet<string>): boolean =>
      resolveSolidCallee(node, context, names) != null ||
      (services != null && resolveTypeAwareSolidCallee(node, services, names) != null);
    const isSolidCallbackArgument = (
      node: FunctionNode,
      argumentIndex: number,
      names: ReadonlySet<string>,
    ): boolean => {
      const call = node.parent;
      return (
        call?.type === "CallExpression" &&
        call.arguments[argumentIndex] === node &&
        isSolidApi(call.callee, names)
      );
    };
    const forbiddenStack: T.FunctionLike[] = [];

    const onFunctionEnter = (node: T.FunctionLike) => {
      if (
        node.type !== "FunctionDeclaration" &&
        node.type !== "FunctionExpression" &&
        node.type !== "ArrowFunctionExpression"
      ) {
        return;
      }

      const trackedEffect = isSolidCallbackArgument(node, 0, TRACKED_EFFECT_NAMES);
      let ownerBackedSettled = false;
      if (isSolidCallbackArgument(node, 0, ON_SETTLED_NAMES)) {
        const settledCall = node.parent as T.CallExpression;
        const enclosing = getNearestFunctionAncestor(settledCall);
        ownerBackedSettled =
          enclosing != null &&
          (isComponent(enclosing, context) ||
            isSolidCallbackArgument(enclosing, 0, OWNER_CALLBACK_NAMES) ||
            isSolidCallbackArgument(enclosing, 1, OWNER_CALLBACK_NAMES));
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
        if (!currentForbidden || getNearestFunctionAncestor(node) !== currentForbidden) {
          return;
        }

        const callee = node.callee;
        if (isSolidApi(callee, ON_CLEANUP_NAMES)) {
          context.report({ node: callee, messageId: "noCleanup" });
        } else if (isSolidApi(callee, FLUSH_NAMES)) {
          context.report({ node: callee, messageId: "noFlush" });
        } else if (isSolidApi(callee, PRIMITIVE_NAMES)) {
          context.report({ node: callee, messageId: "noPrimitives" });
        } else if (
          isSolidApi(callee, FUNCTION_FORM_PRIMITIVE_NAMES) &&
          hasProvablyFunctionFirstArgument(node, context)
        ) {
          context.report({ node: callee, messageId: "noPrimitives" });
        }
      },
    };
  },
});
