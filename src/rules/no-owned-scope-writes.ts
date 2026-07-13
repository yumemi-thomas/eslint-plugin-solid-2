import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { getReactiveBindingFact } from "../analysis/solid-bindings.js";
import {
  getComputationCallbackRole,
  OWNED_WRITE_FORBIDDEN_ROLES,
} from "../analysis/computation-roles.js";
import {
  getTypeAwareServices,
  resolveTypeAwareSolidCallee,
} from "../analysis/typescript-semantics.js";
import type { FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { resolveSolidCallee } from "./solid-rule-utils.js";

// Factories that accept a `{ ownedWrite: true }` option, opting the setter out of the rule.
const OWNED_WRITE_FACTORIES = new Set(["createSignal", "createOptimistic"]);
const ACTION_FACTORIES = new Set(["action"]);
const REFRESH_NAMES = new Set(["refresh"]);

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

function isOwnedScopeFunction(
  node: FunctionNode,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
): boolean {
  const role = getComputationCallbackRole(node, context);
  return role != null && OWNED_WRITE_FORBIDDEN_ROLES.has(role);
}

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "noActionInOwnedScope" | "noOwnedScopeRefresh" | "noOwnedScopeWrite";

export default createRule<Options, MessageIds>({
  name: "no-owned-scope-writes",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow signal/store writes inside component bodies and reactive compute scopes in Solid 2.",
    },
    schema: [
      {
        type: "object",
        properties: {
          // Opt in to type-aware analysis: also detect components used as `<C/>` in other files.
          // Requires ESLint type information and is slower; off by default.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noActionInOwnedScope:
        "Calling an action inside a component or reactive compute scope is not allowed in Solid 2. Call it from an event handler or another imperative scope.",
      noOwnedScopeRefresh:
        "Calling refresh() inside a component or reactive compute scope is not allowed in Solid 2. Move the invalidation to an event handler, effect apply phase, or another imperative scope.",
      noOwnedScopeWrite:
        "Writing to state inside a component or reactive compute scope is not allowed in Solid 2. Derive values instead, move the write to an event handler or apply phase, or use `ownedWrite: true` for internal `createSignal` state.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const services = context.options[0]?.typescriptEnabled ? getTypeAwareServices(context) : null;
    const isSolidApi = (node: T.Node, names: ReadonlySet<string>): boolean =>
      resolveSolidCallee(node, context, names) != null ||
      (services != null && resolveTypeAwareSolidCallee(node, services, names) != null);
    const functionStack: FunctionNode[] = [];
    // A setter can be *called* (inside a closure) before its declaration is traversed — e.g. the
    // apply callback of `createEffect(() => count(), () => setCount(1))` above the `createSignal`.
    // So we collect setter calls and resolve them against the completed setter map on exit.
    const pendingCalls: Array<{ callee: T.Identifier; enclosingFn: FunctionNode }> = [];
    const pendingDirectActions: Array<{ call: T.CallExpression; enclosingFn: FunctionNode }> = [];
    const pendingRefreshes: Array<{ call: T.CallExpression; enclosingFn: FunctionNode }> = [];
    const onFunctionEnter = (node: FunctionNode) => {
      functionStack.push(node);
    };

    const onFunctionExit = () => {
      functionStack.pop();
    };

    return {
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      CallExpression(node) {
        const enclosingFn = functionStack[functionStack.length - 1];
        if (!enclosingFn) {
          return;
        }

        if (
          node.callee.type === "CallExpression" &&
          isSolidApi(node.callee.callee, ACTION_FACTORIES)
        ) {
          pendingDirectActions.push({ call: node, enclosingFn });
          return;
        }

        if (isSolidApi(node.callee, REFRESH_NAMES)) {
          pendingRefreshes.push({ call: node, enclosingFn });
          return;
        }

        if (node.callee.type !== "Identifier") {
          return;
        }

        pendingCalls.push({ callee: node.callee, enclosingFn });
      },
      "Program:exit"() {
        // The same enclosing function recurs across many setter calls; resolve its owned-scope
        // verdict once.
        const ownedScopeCache = new Map<FunctionNode, boolean>();
        const isOwnedScope = (fn: FunctionNode): boolean => {
          let verdict = ownedScopeCache.get(fn);
          if (verdict === undefined) {
            verdict = isOwnedScopeFunction(fn, context);
            ownedScopeCache.set(fn, verdict);
          }
          return verdict;
        };

        for (const { callee, enclosingFn } of pendingCalls) {
          const fact = getReactiveBindingFact(callee, context);
          if (fact?.role === "action" && isOwnedScope(enclosingFn)) {
            context.report({ node: callee, messageId: "noActionInOwnedScope" });
            continue;
          }
          if (fact?.role !== "setter") {
            continue;
          }

          const factoryCall = fact.declaration.init;
          const allowOwnedWrite =
            factoryCall?.type === "CallExpression" &&
            OWNED_WRITE_FACTORIES.has(fact.factory) &&
            hasOwnedWriteOption(factoryCall);
          if (allowOwnedWrite) {
            continue;
          }

          if (isOwnedScope(enclosingFn)) {
            context.report({
              node: callee,
              messageId: "noOwnedScopeWrite",
            });
          }
        }

        for (const { call, enclosingFn } of pendingDirectActions) {
          if (isOwnedScope(enclosingFn)) {
            context.report({ node: call, messageId: "noActionInOwnedScope" });
          }
        }

        for (const { call, enclosingFn } of pendingRefreshes) {
          if (isOwnedScope(enclosingFn)) {
            context.report({ node: call, messageId: "noOwnedScopeRefresh" });
          }
        }
      },
    };
  },
});
