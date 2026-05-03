import { ASTUtils, ESLintUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { collectSolidAliases, getPropertyName, matchesSolidName } from "./solid-rule-utils.js";
import { isFunctionNode, type FunctionNode } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const ACCESSOR_FACTORIES = new Set(["createMemo", "createProjection"]);
const PAIR_ACCESSOR_FACTORIES = new Set(["createOptimistic", "createSignal"]);
const EFFECT_NAMES = new Set(["createEffect", "createRenderEffect"]);
const TRACKED_SCOPES = new Set(["createEffect", "createMemo", "createRenderEffect", "untrack"]);

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow calling signal accessors directly in createEffect apply callbacks without untrack.",
    },
    schema: [],
    messages: {
      noSignalInEffectApply:
        "Signal '{{name}}' is called directly in an effect apply callback. The apply phase runs untracked — read it in the compute phase and use the passed value, or wrap it in `untrack()`.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const accessorAliases = new Set<string>();
    const pairAccessorAliases = new Set<string>();
    const effectAliases = new Set<string>();
    const trackedScopeAliases = new Set<string>();
    const reactiveVars = new Map<TSESLint.Scope.Variable, "accessor">();
    const applyCallbacks = new Set<FunctionNode>();

    const getInlineFunction = (value: T.Node | null | undefined): FunctionNode | null => {
      if (value == null || value.type === "SpreadElement") {
        return null;
      }
      return isFunctionNode(value) ? value : null;
    };

    const getApplyCallback = (value: T.Node | null | undefined): FunctionNode | null => {
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

    const findContainingApplyCallback = (node: T.Node): FunctionNode | null => {
      let current: T.Node | null | undefined = node.parent;
      while (current != null) {
        if (isFunctionNode(current)) {
          const parentNode: T.Node | undefined = current.parent;
          if (
            parentNode?.type === "CallExpression" &&
            parentNode.arguments[0] === current &&
            parentNode.callee.type === "Identifier" &&
            matchesSolidName(parentNode.callee.name, trackedScopeAliases, TRACKED_SCOPES)
          ) {
            return null;
          }

          if (applyCallbacks.has(current)) {
            return current;
          }
        }
        current = current.parent;
      }
      return null;
    };

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, ACCESSOR_FACTORIES, accessorAliases);
        collectSolidAliases(node, PAIR_ACCESSOR_FACTORIES, pairAccessorAliases);
        collectSolidAliases(node, EFFECT_NAMES, effectAliases);
        collectSolidAliases(node, TRACKED_SCOPES, trackedScopeAliases);
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          matchesSolidName(node.init.callee.name, accessorAliases, ACCESSOR_FACTORIES)
        ) {
          const variable = ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
          if (variable) {
            reactiveVars.set(variable, "accessor");
          }
          return;
        }

        if (
          node.id.type === "ArrayPattern" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          matchesSolidName(node.init.callee.name, pairAccessorAliases, PAIR_ACCESSOR_FACTORIES)
        ) {
          const first = node.id.elements[0];
          if (first?.type === "Identifier") {
            const variable = sourceCode.scopeManager
              ?.getDeclaredVariables(node)
              .find((declared) => declared.name === first.name);
            if (variable) {
              reactiveVars.set(variable, "accessor");
            }
          }
        }
      },
      CallExpression(node) {
        // Register apply callbacks before descending — the visitor enters CallExpression
        // before its arguments, so signal calls inside them see a populated apply set.
        if (
          node.callee.type === "Identifier" &&
          matchesSolidName(node.callee.name, effectAliases, EFFECT_NAMES) &&
          node.arguments.length >= 2
        ) {
          const apply = getApplyCallback(node.arguments[1]);
          if (apply) {
            applyCallbacks.add(apply);
          }
        }

        if (node.callee.type !== "Identifier") {
          return;
        }

        const variable = ASTUtils.findVariable(sourceCode.getScope(node), node.callee);
        if (!variable || reactiveVars.get(variable) !== "accessor") {
          return;
        }

        if (findContainingApplyCallback(node) === null) {
          return;
        }

        context.report({
          node,
          messageId: "noSignalInEffectApply",
          data: { name: node.callee.name },
        });
      },
    };
  },
});
