import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { ASTUtils } from "@typescript-eslint/utils";
import { isDOMElementName, trace } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow usage of type-unsafe event handlers.",
    },
    schema: [],
    messages: {
      noArrayHandlers: "Passing an array as an event handler is potentially type-unsafe.",
    },
  },
  defaultOptions: [],
  create(context) {
    const resolveValue = (node: T.Expression): T.Node => {
      const traced = trace(node, context);
      if (traced.type !== "Identifier") {
        return traced;
      }

      const variable = ASTUtils.findVariable(context.sourceCode.getScope(traced), traced);
      const definition = variable?.defs[0];
      if (
        definition?.type === "Variable" &&
        definition.node.parent?.type === "VariableDeclaration" &&
        definition.node.parent.kind === "const" &&
        definition.node.id.type === "Identifier" &&
        definition.node.init != null
      ) {
        return trace(definition.node.init, context);
      }

      return traced;
    };

    return {
      JSXAttribute(node) {
        const openingElement = node.parent as T.JSXOpeningElement;
        if (
          openingElement.name.type !== "JSXIdentifier" ||
          !isDOMElementName(openingElement.name.name)
        ) {
          return;
        }

        const isNamespacedHandler =
          node.name.type === "JSXNamespacedName" && node.name.namespace.name === "on";
        const isNormalEventHandler =
          node.name.type === "JSXIdentifier" && /^on[a-zA-Z]/.test(node.name.name);

        if (
          (isNamespacedHandler || isNormalEventHandler) &&
          node.value?.type === "JSXExpressionContainer" &&
          node.value.expression.type !== "JSXEmptyExpression" &&
          resolveValue(node.value.expression).type === "ArrayExpression"
        ) {
          context.report({
            node,
            messageId: "noArrayHandlers",
          });
        }
      },
    };
  },
});
