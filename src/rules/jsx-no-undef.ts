import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { appendImports, formatList, insertImports, isDOMElementName } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const AUTO_COMPONENTS = [
  "For",
  "Show",
  "Switch",
  "Match",
  "Loading",
  "Errored",
  "Reveal",
  "Repeat",
];
const SOURCE_MODULE = "solid-js";

type MessageIds = "autoImport" | "undefined";
type Options = [
  {
    allowGlobals?: boolean;
    autoImport?: boolean;
    typescriptEnabled?: boolean;
  }?,
];

export default createRule<Options, MessageIds>({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow references to undefined variables in JSX.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          allowGlobals: { type: "boolean" },
          autoImport: { type: "boolean" },
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      autoImport: "{{imports}} should be imported from '{{source}}'.",
      undefined: "'{{identifier}}' is not defined.",
    },
  },
  defaultOptions: [],
  create(context) {
    const allowGlobals = context.options[0]?.allowGlobals ?? false;
    const autoImport = context.options[0]?.autoImport !== false;
    const isTypeScriptEnabled = context.options[0]?.typescriptEnabled ?? false;
    const missingComponents = new Set<string>();
    const sourceCode = context.sourceCode;

    const isDefined = (node: T.Identifier | T.JSXIdentifier): boolean => {
      let scope = sourceCode.getScope(node);
      const sourceType = sourceCode.ast.sourceType;
      const scopeUpperBound = !allowGlobals && sourceType === "module" ? "module" : "global";
      const variables = [...scope.variables];

      while (scope.type !== scopeUpperBound && scope.type !== "global" && scope.upper) {
        scope = scope.upper;
        variables.push(...scope.variables);
      }

      return variables.some((variable) => variable.name === node.name);
    };

    const checkIdentifier = (node: T.Identifier | T.JSXIdentifier, isComponent = false) => {
      if (node.name === "this" || isDefined(node)) {
        return;
      }

      if (isComponent && autoImport && AUTO_COMPONENTS.includes(node.name)) {
        missingComponents.add(node.name);
        return;
      }

      if (!isTypeScriptEnabled) {
        context.report({
          node,
          messageId: "undefined",
          data: { identifier: node.name },
        });
      }
    };

    return {
      JSXOpeningElement(node) {
        switch (node.name.type) {
          case "JSXIdentifier":
            if (!isDOMElementName(node.name.name)) {
              checkIdentifier(node.name, true);
            }
            break;
          case "JSXMemberExpression": {
            let current: T.JSXMemberExpression["object"] = node.name.object;
            while (current.type === "JSXMemberExpression") {
              current = current.object;
            }
            if (current.type === "JSXIdentifier") {
              checkIdentifier(current);
            }
            break;
          }
          default:
            break;
        }
      },
      "Program:exit"(programNode: T.Program) {
        if (!autoImport || missingComponents.size === 0) {
          return;
        }

        const names = [...missingComponents.values()];
        const importNode = programNode.body.find(
          (child): child is T.ImportDeclaration =>
            child.type === "ImportDeclaration" &&
            child.importKind !== "type" &&
            child.source.type === "Literal" &&
            child.source.value === SOURCE_MODULE,
        );

        const reportNode = importNode ?? programNode;
        context.report({
          node: reportNode,
          messageId: "autoImport",
          data: {
            imports: formatList(names),
            source: SOURCE_MODULE,
          },
          fix: (fixer) =>
            importNode
              ? appendImports(fixer, sourceCode, importNode, names)
              : insertImports(fixer, sourceCode, SOURCE_MODULE, names),
        });
      },
    };
  },
});
