import { TSESTree as T } from "@typescript-eslint/utils";
import { isHostElement, jsxGetAllProps } from "../utils.js";
import { createRule } from "./create-rule.js";

type MessageIds = "noDuplicateChildren";

function hasMeaningfulChildren(element: T.JSXElement): boolean {
  return element.children.some((child) => {
    if (child.type === "JSXText") {
      return child.value.trim().length > 0;
    }
    if (child.type === "JSXExpressionContainer") {
      return child.expression.type !== "JSXEmptyExpression";
    }
    return true;
  });
}

export default createRule<[], MessageIds>({
  name: "jsx-no-duplicate-props",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow competing JSX content sources such as children, innerHTML, and textContent.",
    },
    schema: [],
    messages: {
      noDuplicateChildren: "Using {{used}} at the same time is not allowed.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        const props = new Set<string>();
        for (const [name] of jsxGetAllProps(node.attributes)) {
          props.add(name.toLowerCase());
        }

        const hasChildrenProp = props.has("children");
        const element = node.parent as T.JSXElement;
        const hasChildren = hasMeaningfulChildren(element);
        const isHost = isHostElement(node);
        const hasInnerHTML = isHost && props.has("innerhtml");
        const hasTextContent = isHost && props.has("textcontent");
        const used = [
          hasChildrenProp && "`props.children`",
          hasChildren && "JSX children",
          hasInnerHTML && "`props.innerHTML`",
          hasTextContent && "`props.textContent`",
        ].filter(Boolean);

        if (used.length > 1) {
          context.report({
            node,
            messageId: "noDuplicateChildren",
            data: { used: used.join(", ") },
          });
        }
      },
    };
  },
});
