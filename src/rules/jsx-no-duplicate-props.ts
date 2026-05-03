import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { jsxGetAllProps } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

type MessageIds = "noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps";
type Options = [{ ignoreCase?: boolean }?];

export default createRule<Options, MessageIds>({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow passing the same prop twice in JSX.",
    },
    schema: [
      {
        type: "object",
        properties: {
          ignoreCase: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDuplicateChildren: "Using {{used}} at the same time is not allowed.",
      noDuplicateClass:
        "Duplicate `class` props are not allowed. Compose classes in a single `class` value instead.",
      noDuplicateProps: "Duplicate props are not allowed.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        const ignoreCase = context.options[0]?.ignoreCase ?? false;
        const props = new Set<string>();

        const normalize = (name: string): string => {
          let normalized = ignoreCase ? name.toLowerCase() : name;
          normalized = normalized.replace(/^(?:attr|prop):/i, "");

          if (/^on(?:capture)?:/i.test(normalized)) {
            return normalized.toLowerCase();
          }

          if (/^on[a-zA-Z]/.test(normalized)) {
            return normalized.toLowerCase();
          }

          return normalized;
        };

        for (const [name, propNode] of jsxGetAllProps(node.attributes)) {
          const normalized = normalize(name);
          if (props.has(normalized)) {
            context.report({
              node: propNode,
              messageId: normalized === "class" ? "noDuplicateClass" : "noDuplicateProps",
            });
          }
          props.add(normalized);
        }

        const hasChildrenProp = props.has("children");
        const element = node.parent as T.JSXElement | T.JSXFragment;
        const hasChildren = element.children.length > 0;
        const hasInnerHTML = props.has("innerHTML") || props.has("innerhtml");
        const hasTextContent = props.has("textContent") || props.has("textcontent");
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
