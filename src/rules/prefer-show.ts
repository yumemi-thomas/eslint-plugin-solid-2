import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isJSXElementOrFragment } from "../utils.js";
import { createRule } from "./create-rule.js";
import { getSolidImportFixes } from "./solid-rule-utils.js";

// Only treat a branch as worth a `<Show>` when it is actual JSX. Including bare `Identifier`
// here made the rule fire on (and autofix) plain value ternaries like `{a ? b : c}`, turning a
// non-JSX conditional value into a control-flow component — a behavior-changing false positive.
const EXPENSIVE_TYPES = new Set(["JSXElement", "JSXFragment"]);

export default createRule({
  name: "prefer-show",
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer Solid's <Show /> component for JSX conditionals.",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      preferShowAnd: "Use Solid's `<Show />` component for conditionally showing content.",
      preferShowTernary:
        "Use Solid's `<Show />` component for conditionally showing content with a fallback.",
      convertToShow: "Convert to `<Show />`.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const putIntoJSX = (node: T.Node): string => {
      const text = sourceCode.getText(node);
      return isJSXElementOrFragment(node) ? text : `{${text}}`;
    };

    const replaceTarget = (node: T.Node): T.Node =>
      node.parent?.type === "JSXExpressionContainer" && isJSXElementOrFragment(node.parent.parent)
        ? node.parent
        : node;

    // The rewrite references `<Show>`; make sure it resolves to solid-js (adding the import if
    // needed) or skip the fix — it must never emit a reference to the wrong binding.
    const withShowImport = (
      fixer: TSESLint.RuleFixer,
      replacement: TSESLint.RuleFix,
    ): TSESLint.RuleFix[] | null => {
      const importFixes = getSolidImportFixes(context, fixer, ["Show"]);
      return importFixes == null ? null : [...importFixes, replacement];
    };

    const logicalExpressionHandler = (node: T.LogicalExpression) => {
      if (node.operator !== "&&" || !EXPENSIVE_TYPES.has(node.right.type)) {
        return;
      }

      // Offer the `<Show>` rewrite as a *suggestion*, never an autofix. `cond && <X/>` evaluates to
      // the left operand when it is falsy, and Solid renders falsy-but-renderable values (`0`,
      // `NaN`) as text — which `<Show>` would drop. A mechanical `--fix` could therefore change
      // behavior, so the rewrite is left for the author to apply per-occurrence.
      context.report({
        node,
        messageId: "preferShowAnd",
        suggest: [
          {
            messageId: "convertToShow",
            fix: (fixer) =>
              withShowImport(
                fixer,
                fixer.replaceText(
                  replaceTarget(node),
                  `<Show when={${sourceCode.getText(node.left)}}>${putIntoJSX(node.right)}</Show>`,
                ),
              ),
          },
        ],
      });
    };

    const conditionalExpressionHandler = (node: T.ConditionalExpression) => {
      if (!EXPENSIVE_TYPES.has(node.consequent.type) && !EXPENSIVE_TYPES.has(node.alternate.type)) {
        return;
      }

      context.report({
        node,
        messageId: "preferShowTernary",
        fix: (fixer) =>
          withShowImport(
            fixer,
            fixer.replaceText(
              replaceTarget(node),
              `<Show when={${sourceCode.getText(node.test)}} fallback={${sourceCode.getText(node.alternate)}}>${putIntoJSX(node.consequent)}</Show>`,
            ),
          ),
      });
    };

    // Unwrap a render-callback arrow to the expression it renders: its concise body, or the
    // argument of its final `return` for a block body.
    const renderedExpression = (
      expression: T.Expression | T.JSXEmptyExpression,
    ): T.Expression | T.JSXEmptyExpression => {
      if (expression.type !== "ArrowFunctionExpression") {
        return expression;
      }
      if (expression.body.type !== "BlockStatement") {
        return expression.body;
      }
      const lastReturn = [...expression.body.body]
        .reverse()
        .find((statement): statement is T.ReturnStatement => statement.type === "ReturnStatement");
      return lastReturn?.argument ?? expression;
    };

    return {
      JSXExpressionContainer(node) {
        if (!isJSXElementOrFragment(node.parent)) {
          return;
        }

        const expression = renderedExpression(node.expression);
        if (expression.type === "LogicalExpression") {
          logicalExpressionHandler(expression);
        } else if (expression.type === "ConditionalExpression") {
          conditionalExpressionHandler(expression);
        }
      },
    };
  },
});
