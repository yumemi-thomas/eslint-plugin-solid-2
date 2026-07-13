import { TSESTree as T } from "@typescript-eslint/utils";
import { isDOMElementName, isHostElement } from "../utils.js";
import { createRule } from "./create-rule.js";

type MessageIds = "dontSelfClose" | "selfClose";
type Options = [{ component?: "all" | "none"; html?: "all" | "none" | "void" }?];

const voidDOMElementRegex =
  /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;

const isComponent = (node: T.JSXOpeningElement): boolean =>
  (node.name.type === "JSXIdentifier" && !isDOMElementName(node.name.name)) ||
  node.name.type === "JSXMemberExpression";

const isVoidDOMElementName = (name: string): boolean => voidDOMElementRegex.test(name);

const childrenIsEmpty = (node: T.JSXOpeningElement): boolean =>
  (node.parent as T.JSXElement).children.length === 0;

const childrenIsMultilineSpaces = (node: T.JSXOpeningElement): boolean => {
  const children = (node.parent as T.JSXElement).children;
  return (
    children.length === 1 &&
    children[0].type === "JSXText" &&
    children[0].value.includes("\n") &&
    children[0].value.replace(/(?!\xA0)\s/g, "") === ""
  );
};

export default createRule<Options, MessageIds>({
  name: "self-closing-comp",
  meta: {
    type: "layout",
    docs: {
      description: "Disallow extra closing tags for components without children.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          component: { enum: ["all", "none"], type: "string" },
          html: { enum: ["all", "void", "none"], type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      dontSelfClose: "This element should not be self-closing.",
      selfClose: "Empty components are self-closing.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;

    const shouldBeSelfClosedWhenPossible = (node: T.JSXOpeningElement): boolean => {
      if (isComponent(node)) {
        return (context.options[0]?.component ?? "all") === "all";
      }

      if (isHostElement(node)) {
        switch (context.options[0]?.html ?? "all") {
          case "all":
            return true;
          case "void":
            return node.name.type === "JSXIdentifier" && isVoidDOMElementName(node.name.name);
          case "none":
            return false;
        }
      }

      return true;
    };

    return {
      JSXOpeningElement(node) {
        const canSelfClose = childrenIsEmpty(node) || childrenIsMultilineSpaces(node);
        if (!canSelfClose) {
          return;
        }

        const shouldSelfClose = shouldBeSelfClosedWhenPossible(node);
        if (shouldSelfClose && !node.selfClosing) {
          context.report({
            node,
            messageId: "selfClose",
            fix: (fixer) => {
              const openingElementEnding = node.range[1] - 1;
              const closingElementEnding = (node.parent as T.JSXElement).closingElement!.range[1];
              return fixer.replaceTextRange([openingElementEnding, closingElementEnding], " />");
            },
          });
        } else if (!shouldSelfClose && node.selfClosing) {
          context.report({
            node,
            messageId: "dontSelfClose",
            fix: (fixer) => {
              const tagName = sourceCode.getText(node.name);
              const selfCloseEnding = node.range[1];
              const lastTokens = sourceCode.getLastTokens(node, { count: 3 });
              const isSpaceBeforeSelfClose = sourceCode.isSpaceBetween(
                lastTokens[0],
                lastTokens[1],
              );
              const range: [number, number] = [
                isSpaceBeforeSelfClose ? selfCloseEnding - 3 : selfCloseEnding - 2,
                selfCloseEnding,
              ];
              return fixer.replaceTextRange(range, `></${tagName}>`);
            },
          });
        }
      },
    };
  },
});
