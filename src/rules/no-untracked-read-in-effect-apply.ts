import { ASTUtils, TSESTree as T } from "@typescript-eslint/utils";
import { getReactiveBindingFact, type ReactiveBindingFact } from "../analysis/solid-bindings.js";
import {
  getTypeAwareServices,
  isSolidAccessorExpression,
  isTypeAwareSolidCallee,
} from "../analysis/typescript-semantics.js";
import { createRule } from "./create-rule.js";
import {
  getNearestFunctionAncestor,
  getPropertyName,
  getReturnedExpressions,
  resolveSolidCallee,
} from "./solid-rule-utils.js";
import { isFunctionNode, trace, type FunctionNode } from "../utils.js";

// The effect *apply* phase runs untracked. Two ways to accidentally read reactive state there, both
// surfacing the same `STRICT_READ_UNTRACKED` problem (see docs/adr/0006):
//   1. Calling a signal/memo accessor directly in the apply callback.
//   2. Passing a store proxy through the compute return and reading its properties in apply.
const EFFECT_NAMES = new Set(["createEffect", "createRenderEffect"]);
const SAFE_HELPERS = new Set(["deep", "snapshot"]);

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "signalRead" | "storeProxyRead";

export default createRule<Options, MessageIds>({
  name: "no-untracked-read-in-effect-apply",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading reactive state (signal accessors or store proxies) in a createEffect apply callback, which runs untracked.",
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
      signalRead:
        "Signal '{{name}}' is called directly in an effect apply callback. The apply phase runs untracked — read it in the compute phase and use the passed value, or wrap it in `untrack()`.",
      storeProxyRead:
        "Effect apply callbacks run untracked in Solid 2. Extract store properties in the compute phase or use `deep()` before reading them here.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const services = context.options[0]?.typescriptEnabled ? getTypeAwareServices(context) : null;

    const isEffectFactory = (node: T.Expression): boolean =>
      resolveSolidCallee(node, context, EFFECT_NAMES) != null ||
      (services != null && isTypeAwareSolidCallee(node, services, EFFECT_NAMES));

    // --- signal-accessor detection state -----------------------------------------------------
    const applyCallbacks = new Set<FunctionNode>();
    const pendingAccessorCalls: T.CallExpression[] = [];

    // Walk a member chain to its root identifier and the ordered property path (`store.user.name`
    // → { root: store, path: ["user", "name"] }). Returns null for a computed/dynamic access.
    const getMemberPath = (
      node: T.MemberExpression,
    ): { root: T.Identifier; path: string[] } | null => {
      const path: string[] = [];
      let current: T.Expression = node;
      while (current.type === "MemberExpression") {
        if (current.computed || current.property.type !== "Identifier") {
          return null;
        }
        path.unshift(current.property.name);
        current = current.object;
      }
      return current.type === "Identifier" ? { root: current, path } : null;
    };

    // Whether the value at `path` within a known store shape is an object/array (a proxy) rather
    // than a primitive leaf. `"unknown"` when the path can't be resolved statically.
    const pathLandsOnProxy = (
      shape: T.ObjectExpression | null,
      path: string[],
    ): boolean | "unknown" => {
      if (shape == null) {
        return "unknown";
      }
      let current: T.Node = shape;
      for (const key of path) {
        if (current.type !== "ObjectExpression") {
          return "unknown";
        }
        let next: T.Node | undefined;
        for (const candidate of current.properties) {
          if (candidate.type === "Property" && getPropertyName(candidate) === key) {
            next = candidate.value;
            break;
          }
        }
        if (next == null) {
          return "unknown";
        }
        current = next;
      }
      return current.type === "ObjectExpression" || current.type === "ArrayExpression";
    };

    const getStoreShape = (fact: ReactiveBindingFact): T.ObjectExpression | null => {
      const init = fact.declaration.init;
      if (init?.type !== "CallExpression") {
        return null;
      }
      const first = init.arguments[0];
      const seed =
        first != null &&
        first.type !== "SpreadElement" &&
        (first.type === "FunctionExpression" || first.type === "ArrowFunctionExpression")
          ? init.arguments[1]
          : first;
      return seed?.type === "ObjectExpression" ? seed : null;
    };

    // ===== signal-accessor helpers ===========================================================
    const getInlineFunction = (value: T.Node | null | undefined): FunctionNode | null => {
      if (value == null || value.type === "SpreadElement") {
        return null;
      }
      if (isFunctionNode(value)) {
        return value;
      }
      const traced = trace(value, context);
      return isFunctionNode(traced) ? traced : null;
    };

    const getInlineApplyCallback = (value: T.Node | null | undefined): FunctionNode | null => {
      const direct = getInlineFunction(value);
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
        const fn = getInlineFunction(property.value);
        if (fn) {
          return fn;
        }
      }
      return null;
    };

    // The read must happen *directly* in the apply callback — its nearest function ancestor is the
    // apply function itself. A read inside a closure created during apply (an event handler, a
    // setInterval callback) runs later, outside the apply phase, where untracked signal reads are
    // sanctioned — the runtime's STRICT_READ_UNTRACKED does not fire there, and neither do we.
    // A read wrapped in `untrack(() => ...)` also resolves to the untrack arrow, not the apply
    // callback, so it is correctly left alone.
    const findContainingApplyCallback = (node: T.Node): FunctionNode | null => {
      const nearest = getNearestFunctionAncestor(node);
      return nearest != null && applyCallbacks.has(nearest) ? nearest : null;
    };

    // ===== store-proxy helpers ===============================================================
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

    const getTracedApplyCallback = (
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
        resolveSolidCallee(node.callee, context, SAFE_HELPERS) != null
      ) {
        return false;
      }
      if (node.type === "Identifier") {
        return getReactiveBindingFact(node, context)?.role === "store";
      }
      if (node.type === "MemberExpression") {
        const resolved = getMemberPath(node);
        if (resolved == null) {
          // A computed path may land on a primitive. Without type information that is not a proven
          // proxy passthrough, so leave it alone rather than report correct code.
          return false;
        }

        const fact = getReactiveBindingFact(resolved.root, context);
        if (fact?.role !== "store") {
          return false;
        }
        // Only a path proven to land on an object/array is a proxy passthrough. Unknown initializer
        // shapes may be primitive leaves and must not be guessed under the zero-FP contract.
        return pathLandsOnProxy(getStoreShape(fact), resolved.path) === true;
      }
      return false;
    };

    const checkStoreProxyInApply = (node: T.CallExpression): void => {
      if (!isEffectFactory(node.callee) || node.arguments.length < 2) {
        return;
      }
      const compute = getFunctionValue(node.arguments[0]);
      const apply = getTracedApplyCallback(node.arguments[1]);
      if (!compute || !apply) {
        return;
      }
      const returned = getReturnedExpressions(compute).filter(
        (value): value is T.Expression => value != null,
      );
      if (returned.length === 0) {
        return;
      }
      if (!returned.some((value) => isStoreSourceExpression(value)) || apply.params.length === 0) {
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
        // Only reads that happen *during* the apply phase count; a read inside a closure created
        // in apply (event handler, timer callback) runs later, where untracked reads are fine.
        if (getNearestFunctionAncestor(identifier) !== apply) {
          continue;
        }
        if (
          identifier.parent?.type === "VariableDeclarator" &&
          identifier.parent.init === identifier &&
          (identifier.parent.id.type === "ObjectPattern" ||
            identifier.parent.id.type === "ArrayPattern")
        ) {
          context.report({ node: identifier.parent, messageId: "storeProxyRead" });
          break;
        }
        if (identifier.parent?.type === "SpreadElement") {
          context.report({ node: identifier.parent, messageId: "storeProxyRead" });
          break;
        }
        if (
          identifier.parent?.type === "MemberExpression" &&
          identifier.parent.object === identifier
        ) {
          context.report({ node: identifier.parent, messageId: "storeProxyRead" });
          break;
        }
      }
    };

    return {
      CallExpression(node) {
        // Register apply callbacks before descending — CallExpression is visited before its
        // arguments, so signal calls inside an apply callback see a populated set.
        if (isEffectFactory(node.callee) && node.arguments.length >= 2) {
          const apply = getInlineApplyCallback(node.arguments[1]);
          if (apply) {
            applyCallbacks.add(apply);
          }
        }

        // store-proxy-through-compute detection (runs on the effect call itself)
        checkStoreProxyInApply(node);

        pendingAccessorCalls.push(node);
      },
      "Program:exit"() {
        // Resolve after traversal so apply callbacks and accessors declared below their use have
        // both been indexed.
        for (const node of pendingAccessorCalls) {
          const callee = node.callee;
          const astAccessor =
            callee.type === "Identifier" &&
            getReactiveBindingFact(callee, context)?.role === "accessor";
          const typedAccessor = services != null && isSolidAccessorExpression(callee, services);
          if ((astAccessor || typedAccessor) && findContainingApplyCallback(node) != null) {
            context.report({
              node,
              messageId: "signalRead",
              data: { name: sourceCode.getText(callee) },
            });
          }
        }
      },
    };
  },
});
