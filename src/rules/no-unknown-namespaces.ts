import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { isDOMElementName } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const allowedNamespaces = new Set(["on", "prop"]);
const removedNamespaces = new Map<string, string>([
  ["attr", "`attr:` was removed in Solid 2. Use standard attributes instead."],
  ["bool", "`bool:` was removed in Solid 2. Use standard boolean attribute behavior instead."],
  [
    "oncapture",
    "`oncapture:` was removed in Solid 2. Use `addEventListener(..., { capture: true })` instead.",
  ],
  ["use", "`use:` directives were removed in Solid 2. Use `ref={directive(...)}` instead."],
]);
const styleNamespaces = new Set(["class", "style"]);
const xmlNamespaces = new Set(["xmlns", "xlink"]);

type Options = [{ allowedNamespaces?: string[] }?];
type MessageIds = "component" | "componentSuggest" | "removed" | "style" | "unknown";

export default createRule<Options, MessageIds>({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unknown or removed JSX namespaces in Solid 2.",
    },
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          allowedNamespaces: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      component: "Namespaced props have no effect on Solid components.",
      componentSuggest: "Replace `{{namespace}}:{{name}}` with `{{name}}`.",
      removed: "{{message}}",
      style: "Prefer the `{{namespace}}` prop over the `{{namespace}}:` namespace in Solid 2.",
      unknown: "`{{namespace}}:` is not a known Solid 2 JSX namespace.",
    },
  },
  defaultOptions: [],
  create(context) {
    const extras = new Set(context.options[0]?.allowedNamespaces ?? []);

    return {
      "JSXAttribute > JSXNamespacedName"(node: T.JSXNamespacedName) {
        const openingElement = node.parent!.parent as T.JSXOpeningElement;

        if (
          openingElement.name.type === "JSXIdentifier" &&
          !isDOMElementName(openingElement.name.name)
        ) {
          context.report({
            node,
            messageId: "component",
            suggest: [
              {
                messageId: "componentSuggest",
                data: {
                  namespace: node.namespace.name,
                  name: node.name.name,
                },
                fix: (fixer) => fixer.replaceText(node, node.name.name),
              },
            ],
          });
          return;
        }

        const namespace = node.namespace.name;
        if (
          allowedNamespaces.has(namespace) ||
          xmlNamespaces.has(namespace) ||
          extras.has(namespace)
        ) {
          return;
        }

        const removedMessage = removedNamespaces.get(namespace);
        if (removedMessage) {
          context.report({
            node,
            messageId: "removed",
            data: { message: removedMessage },
          });
          return;
        }

        if (styleNamespaces.has(namespace)) {
          context.report({
            node,
            messageId: "style",
            data: { namespace },
          });
          return;
        }

        context.report({
          node,
          messageId: "unknown",
          data: { namespace },
        });
      },
    };
  },
});
