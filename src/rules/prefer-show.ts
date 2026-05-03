import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { isJSXElementOrFragment } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const EXPENSIVE_TYPES = new Set(["Identifier", "JSXElement", "JSXFragment"]);

export default createRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer Solid's <Show /> component for JSX conditionals.",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferShowAnd: "Use Solid's `<Show />` component for conditionally showing content.",
      preferShowTernary:
        "Use Solid's `<Show />` component for conditionally showing content with a fallback.",
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

    const logicalExpressionHandler = (node: T.LogicalExpression) => {
      if (node.operator !== "&&" || !EXPENSIVE_TYPES.has(node.right.type)) {
        return;
      }

      context.report({
        node,
        messageId: "preferShowAnd",
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
          fixer.replaceText(
            replaceTarget(node),
            `<Show when={${sourceCode.getText(node.test)}} fallback={${sourceCode.getText(node.alternate)}}>${putIntoJSX(node.consequent)}</Show>`,
          ),
      });
    };

    return {
      JSXExpressionContainer(node) {
        if (!isJSXElementOrFragment(node.parent)) {
          return;
        }

        if (node.expression.type === "LogicalExpression") {
          logicalExpressionHandler(node.expression);
        } else if (
          node.expression.type === "ArrowFunctionExpression" &&
          node.expression.body.type === "LogicalExpression"
        ) {
          logicalExpressionHandler(node.expression.body);
        } else if (node.expression.type === "ConditionalExpression") {
          conditionalExpressionHandler(node.expression);
        } else if (
          node.expression.type === "ArrowFunctionExpression" &&
          node.expression.body.type === "ConditionalExpression"
        ) {
          conditionalExpressionHandler(node.expression.body);
        }
      },
    };
  },
});
