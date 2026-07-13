import { TSESLint } from "@typescript-eslint/utils";
import { type FunctionNode } from "../utils.js";
import { isComponent } from "./component-recognition.js";
import { resolveSolidCallee } from "./solid-bindings.js";
import { getTypeAwareServices, resolveTypeAwareSolidCallee } from "./typescript-semantics.js";

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

export type ComputationCallbackRole =
  | "component"
  | "derived-signal"
  | "derived-store"
  | "effect-apply"
  | "legacy-effect-compute"
  | "leaf-owner"
  | "memo-compute"
  | "projection-compute"
  | "settled"
  | "split-effect-compute";

const CALLBACK_FACTORIES = new Set([
  "createEffect",
  "createMemo",
  "createProjection",
  "createRenderEffect",
  "createSignal",
  "createStore",
  "createTrackedEffect",
  "onSettled",
]);

/** Classifies a function's exact, binding-proven Solid execution role. */
export function getComputationCallbackRole(
  node: FunctionNode,
  context: RuleContext,
): ComputationCallbackRole | null {
  if (isComponent(node, context)) {
    return "component";
  }
  if (node.type === "FunctionDeclaration") {
    return null;
  }

  const call = node.parent;
  if (call?.type !== "CallExpression") {
    return null;
  }
  const argumentIndex = call.arguments.indexOf(node);
  if (argumentIndex < 0) {
    return null;
  }
  const services = (context.options[0] as { typescriptEnabled?: boolean } | undefined)
    ?.typescriptEnabled
    ? getTypeAwareServices(context)
    : null;
  const factory =
    resolveSolidCallee(call.callee, context, CALLBACK_FACTORIES) ??
    (services == null
      ? null
      : resolveTypeAwareSolidCallee(call.callee, services, CALLBACK_FACTORIES));
  switch (factory) {
    case "createMemo":
      return argumentIndex === 0 ? "memo-compute" : null;
    case "createProjection":
      return argumentIndex === 0 ? "projection-compute" : null;
    case "createSignal":
      return argumentIndex === 0 ? "derived-signal" : null;
    case "createStore":
      return argumentIndex === 0 && call.arguments.length >= 2 ? "derived-store" : null;
    case "createEffect":
    case "createRenderEffect":
      if (call.arguments.length < 2) {
        return argumentIndex === 0 ? "legacy-effect-compute" : null;
      }
      return argumentIndex === 0
        ? "split-effect-compute"
        : argumentIndex === 1
          ? "effect-apply"
          : null;
    case "createTrackedEffect":
      return argumentIndex === 0 ? "leaf-owner" : null;
    case "onSettled":
      return argumentIndex === 0 ? "settled" : null;
    default:
      return null;
  }
}

export const OWNED_WRITE_FORBIDDEN_ROLES = new Set<ComputationCallbackRole>([
  "component",
  "derived-signal",
  "derived-store",
  "memo-compute",
  "projection-compute",
  "split-effect-compute",
]);

export const ASYNC_TRACKED_COMPUTE_ROLES = new Set<ComputationCallbackRole>([
  "derived-signal",
  "derived-store",
  "legacy-effect-compute",
  "memo-compute",
  "projection-compute",
  "split-effect-compute",
]);
