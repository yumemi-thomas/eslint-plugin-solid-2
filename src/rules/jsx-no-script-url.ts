import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const JAVASCRIPT_PROTOCOL = "javascript:";

function isLeadingProtocolPadding(char: string): boolean {
  const code = char.charCodeAt(0);
  return code <= 0x1f || char === " ";
}

function isEmbeddedProtocolPadding(char: string): boolean {
  return char === "\r" || char === "\n" || char === "\t";
}

function isJavaScriptProtocol(value: string): boolean {
  let index = 0;
  while (index < value.length && isLeadingProtocolPadding(value[index])) {
    index += 1;
  }

  for (const expected of JAVASCRIPT_PROTOCOL) {
    while (index < value.length && isEmbeddedProtocolPadding(value[index])) {
      index += 1;
    }

    if (value[index]?.toLowerCase() !== expected) {
      return false;
    }

    index += 1;
  }

  return true;
}

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow javascript: URLs.",
    },
    schema: [],
    messages: {
      noJSURL: "For security, don't use javascript: URLs. Use event handlers instead if you can.",
    },
  },
  defaultOptions: [],
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.value == null) {
          return;
        }

        const rawValue =
          node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        const link = ASTUtils.getStaticValue(rawValue, context.sourceCode.getScope(node));
        if (typeof link?.value === "string" && isJavaScriptProtocol(link.value)) {
          context.report({
            node: node.value,
            messageId: "noJSURL",
          });
        }
      },
    };
  },
});
