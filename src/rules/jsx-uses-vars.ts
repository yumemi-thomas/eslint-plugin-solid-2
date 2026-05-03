import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { markVariableAsUsed } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Prevent variables used in JSX from being marked as unused.",
    },
    schema: [],
    messages: {},
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXOpeningElement(node) {
        switch (node.name.type) {
          case "JSXNamespacedName":
            return;
          case "JSXIdentifier":
            markVariableAsUsed(context, node.name.name, node.name);
            return;
          case "JSXMemberExpression": {
            let parent: T.JSXTagNameExpression = node.name.object;
            while (parent.type === "JSXMemberExpression") {
              parent = parent.object;
            }

            if (parent.type === "JSXIdentifier") {
              markVariableAsUsed(context, parent.name, parent);
            }
          }
        }
      },
    };
  },
});
