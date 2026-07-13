import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import type { FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { bindsToSolid, isComponent, resolveSolidCallee } from "./solid-rule-utils.js";

const SETTER_FACTORIES = new Set([
  "createOptimistic",
  "createOptimisticStore",
  "createSignal",
  "createStore",
]);
// Factories that accept a `{ ownedWrite: true }` option, opting the setter out of the rule.
const OWNED_WRITE_FACTORIES = new Set(["createSignal", "createOptimistic"]);
const EFFECT_FACTORIES = new Set(["createEffect", "createRenderEffect"]);
const COMPUTE_FACTORIES = new Set(["createEffect", "createMemo", "createRenderEffect"]);
const ACTION_FACTORIES = new Set(["action"]);

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
  if (isComponent(node, context)) {
    return true;
  }

  if (
    node.parent?.type !== "CallExpression" ||
    node.parent.arguments[0] !== node ||
    node.parent.callee.type !== "Identifier"
  ) {
    return false;
  }

  // Resolve the enclosing factory by binding, not bare name (ADR-0003): a local `createMemo` or a
  // same-named import from another package is not Solid's compute scope.
  const callee = node.parent.callee;
  if (!bindsToSolid(callee, context, COMPUTE_FACTORIES)) {
    return false;
  }

  // The 1.x single-arg createEffect/createRenderEffect is already marked deprecated.
  // Only flag the 2.0 split form (≥2 args) where the first arg is explicitly the compute phase.
  if (bindsToSolid(callee, context, EFFECT_FACTORIES)) {
    return node.parent.arguments.length >= 2;
  }

  return true;
}

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "noActionInOwnedScope" | "noOwnedScopeWrite";

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
      noOwnedScopeWrite:
        "Writing to state inside a component or reactive compute scope is not allowed in Solid 2. Derive values instead, move the write to an event handler or apply phase, or use `ownedWrite: true` for internal `createSignal` state.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const setterVariables = new Map<TSESLint.Scope.Variable, { allowOwnedWrite: boolean }>();
    const actionVariables = new Set<TSESLint.Scope.Variable>();
    const functionStack: FunctionNode[] = [];
    // A setter can be *called* (inside a closure) before its declaration is traversed — e.g. the
    // apply callback of `createEffect(() => count(), () => setCount(1))` above the `createSignal`.
    // So we collect setter calls and resolve them against the completed setter map on exit.
    const pendingCalls: Array<{ callee: T.Identifier; enclosingFn: FunctionNode }> = [];
    const pendingDirectActions: Array<{ call: T.CallExpression; enclosingFn: FunctionNode }> = [];
    const sourceCode = context.sourceCode;

    const onFunctionEnter = (node: FunctionNode) => {
      functionStack.push(node);
    };

    const onFunctionExit = () => {
      functionStack.pop();
    };

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init?.type === "CallExpression" &&
          resolveSolidCallee(node.init.callee, context, ACTION_FACTORIES) != null
        ) {
          const actionId = node.id;
          const variable = sourceCode.scopeManager
            ?.getDeclaredVariables(node)
            .find((declared) => declared.name === actionId.name);
          if (variable) {
            actionVariables.add(variable);
          }
          return;
        }

        if (node.id.type === "Identifier" && node.init?.type === "Identifier") {
          const source = ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
          if (source && actionVariables.has(source)) {
            const aliasId = node.id;
            const variable = sourceCode.scopeManager
              ?.getDeclaredVariables(node)
              .find((declared) => declared.name === aliasId.name);
            if (variable) {
              actionVariables.add(variable);
            }
          }
        }

        if (
          node.id.type !== "ArrayPattern" ||
          node.init?.type !== "CallExpression" ||
          node.init.callee.type !== "Identifier"
        ) {
          return;
        }

        // Resolve the factory by binding, not bare name (ADR-0003): a local `createSignal` or a
        // state library's `createStore` (e.g. from "redux") is not a Solid setter factory.
        // resolveSolidCallee returns the *canonical* name, so an aliased import resolves correctly.
        const canonical = resolveSolidCallee(node.init.callee, context, SETTER_FACTORIES);
        if (canonical == null) {
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

        // `ownedWrite: true` opts a createSignal/createOptimistic setter out of the rule.
        setterVariables.set(variable, {
          allowOwnedWrite: OWNED_WRITE_FACTORIES.has(canonical) && hasOwnedWriteOption(node.init),
        });
      },
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
          resolveSolidCallee(node.callee.callee, context, ACTION_FACTORIES) != null
        ) {
          pendingDirectActions.push({ call: node, enclosingFn });
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
          const variable = ASTUtils.findVariable(sourceCode.getScope(callee), callee);
          if (variable && actionVariables.has(variable) && isOwnedScope(enclosingFn)) {
            context.report({ node: callee, messageId: "noActionInOwnedScope" });
            continue;
          }
          const setter = variable && setterVariables.get(variable);
          if (!setter || setter.allowOwnedWrite) {
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
      },
    };
  },
});
