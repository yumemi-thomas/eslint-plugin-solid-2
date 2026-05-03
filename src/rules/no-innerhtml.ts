import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";
import isHtml from "is-html";
import { jsxPropName } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

function hasMeaningfulChildren(
  element: import("@typescript-eslint/utils").TSESTree.JSXElement,
): boolean {
  return element.children.some((child) => {
    switch (child.type) {
      case "JSXText":
        return child.value.trim().length > 0;
      case "JSXExpressionContainer":
        return child.expression.type !== "JSXEmptyExpression";
      default:
        return true;
    }
  });
}

type MessageIds = "conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText";
type Options = [{ allowStatic?: boolean }?];

export default createRule<Options, MessageIds>({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow usage of the innerHTML attribute, which can often lead to security vulnerabilities.",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          allowStatic: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      conflict:
        "The innerHTML attribute should not be used on an element with child elements; they will be overwritten.",
      dangerous:
        "The innerHTML attribute is dangerous; passing unsanitized input can lead to security vulnerabilities.",
      dangerouslySetInnerHTML:
        "The dangerouslySetInnerHTML prop is not supported; use innerHTML instead.",
      notHtml: "The string passed to innerHTML does not appear to be valid HTML.",
      useInnerText: "For text content, using innerText is clearer and safer.",
    },
  },
  defaultOptions: [{ allowStatic: true }],
  create(context) {
    const allowStatic = context.options[0]?.allowStatic ?? true;

    return {
      JSXAttribute(node) {
        const propName = jsxPropName(node);
        if (propName === "dangerouslySetInnerHTML") {
          if (
            node.value?.type === "JSXExpressionContainer" &&
            node.value.expression.type === "ObjectExpression" &&
            node.value.expression.properties.length === 1
          ) {
            const htmlProp = node.value.expression.properties[0];
            if (
              htmlProp.type === "Property" &&
              htmlProp.key.type === "Identifier" &&
              htmlProp.key.name === "__html"
            ) {
              context.report({
                node,
                messageId: "dangerouslySetInnerHTML",
                fix: (fixer) => {
                  const propRange = node.range;
                  const valueRange = htmlProp.value.range;
                  return [
                    fixer.replaceTextRange([propRange[0], valueRange[0]], "innerHTML={"),
                    fixer.replaceTextRange([valueRange[1], propRange[1]], "}"),
                  ];
                },
              });
              return;
            }
          }

          context.report({
            node,
            messageId: "dangerouslySetInnerHTML",
          });
          return;
        }

        if (propName !== "innerHTML") {
          return;
        }

        const innerHtmlNode =
          node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;

        if (allowStatic) {
          const innerHtml = innerHtmlNode && ASTUtils.getStringIfConstant(innerHtmlNode);
          if (typeof innerHtml === "string") {
            if (isHtml(innerHtml)) {
              if (
                node.parent?.parent?.type === "JSXElement" &&
                hasMeaningfulChildren(node.parent.parent)
              ) {
                context.report({
                  node: node.parent.parent,
                  messageId: "conflict",
                });
              }
            } else {
              context.report({
                node,
                messageId: "notHtml",
                suggest: [
                  {
                    messageId: "useInnerText",
                    fix: (fixer) => fixer.replaceText(node.name, "innerText"),
                  },
                ],
              });
            }
            return;
          }
        }

        context.report({
          node,
          messageId: "dangerous",
        });
      },
    };
  },
});
