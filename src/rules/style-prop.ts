import { ASTUtils, ESLintUtils } from "@typescript-eslint/utils";
import kebabCaseModule from "kebab-case";
import { all as allCssProperties } from "known-css-properties";
import parseModule from "style-to-object";
import { jsxPropName } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const lengthPercentageRegex = /\b(?:width|height|margin|padding|border-width|font-size)\b/i;
const kebabCase = kebabCaseModule as unknown as (value: string) => string;
const parse = parseModule as unknown as (value: string) => Record<string, string> | null;

type MessageIds = "invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle";
type Options = [{ allowString?: boolean }?];

export default createRule<Options, MessageIds>({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require CSS properties in the `style` prop to be valid and kebab-cased, and require dimensioned numeric values to be strings.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          allowString: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidStyleProp: "{{name}} is not a valid CSS property.",
      kebabStyleProp: "Use {{kebabName}} instead of {{name}}.",
      numericStyleValue:
        'This CSS property value should be a string with a unit; Solid does not automatically append a "px" unit.',
      stringStyle: "Use an object for the style prop instead of a string.",
    },
  },
  defaultOptions: [],
  create(context) {
    const allCssPropertiesSet = new Set(allCssProperties);
    const allowString = context.options[0]?.allowString ?? false;

    return {
      JSXAttribute(node) {
        if (jsxPropName(node) !== "style") {
          return;
        }

        const style =
          node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        if (!style) {
          return;
        }

        if (style.type === "Literal" && typeof style.value === "string" && !allowString) {
          let objectStyles: Record<string, string> | undefined;
          try {
            objectStyles = parse(style.value) ?? undefined;
          } catch {
            objectStyles = undefined;
          }

          context.report({
            node: style,
            messageId: "stringStyle",
            fix:
              objectStyles != null
                ? (fixer) => fixer.replaceText(node.value!, `{${JSON.stringify(objectStyles)}}`)
                : undefined,
          });
          return;
        }

        if (style.type === "TemplateLiteral" && !allowString) {
          context.report({
            node: style,
            messageId: "stringStyle",
          });
          return;
        }

        if (style.type !== "ObjectExpression") {
          return;
        }

        for (const prop of style.properties) {
          if (prop.type !== "Property") {
            continue;
          }

          const name = ASTUtils.getPropertyName(prop, context.sourceCode.getScope(prop));
          if (name && !name.startsWith("--") && !allCssPropertiesSet.has(name)) {
            const kebabName = kebabCase(name);
            if (allCssPropertiesSet.has(kebabName)) {
              context.report({
                node: prop.key,
                messageId: "kebabStyleProp",
                data: { kebabName, name },
                fix: (fixer) => fixer.replaceText(prop.key, `"${kebabName}"`),
              });
            } else {
              context.report({
                node: prop.key,
                messageId: "invalidStyleProp",
                data: { name },
              });
            }
            continue;
          }

          if (!name || (!name.startsWith("--") && lengthPercentageRegex.test(name))) {
            const value = ASTUtils.getStaticValue(prop.value)?.value;
            if (typeof value === "number" && value !== 0) {
              context.report({
                node: prop.value,
                messageId: "numericStyleValue",
              });
            }
          }
        }
      },
    };
  },
});
