import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, isJSXElementOrFragment } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const getPropertyName = (node: T.MemberExpression): string | null => {
  if (!node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }

  if (
    node.computed &&
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return node.property.value;
  }

  return null;
};

function returnsJSX(node: T.FunctionExpression | T.ArrowFunctionExpression): boolean {
  if (node.body.type === "JSXElement" || node.body.type === "JSXFragment") {
    return true;
  }

  if (node.body.type !== "BlockStatement") {
    return false;
  }

  const returnStatement = node.body.body.find(
    (statement): statement is T.ReturnStatement => statement.type === "ReturnStatement",
  );
  return (
    returnStatement?.argument?.type === "JSXElement" ||
    returnStatement?.argument?.type === "JSXFragment"
  );
}

export default createRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer Solid's <For /> component over Array#map when rendering JSX lists.",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferFor:
        "Use Solid's `<For />` component for rendering JSX lists instead of `Array#map(...)`.",
    },
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const containerNode = node.parent?.type === "ChainExpression" ? node.parent : node;
        if (
          containerNode.parent?.type !== "JSXExpressionContainer" ||
          !isJSXElementOrFragment(containerNode.parent.parent)
        ) {
          return;
        }

        const callee = node.callee;
        if (callee.type !== "MemberExpression" || node.arguments.length === 0) {
          return;
        }

        if (node.arguments[0].type === "SpreadElement") {
          return;
        }

        if (getPropertyName(callee) !== "map") {
          return;
        }

        const mapFn = node.arguments[0];
        if (!isFunctionNode(mapFn) || !returnsJSX(mapFn)) {
          return;
        }

        const canAutoFix =
          node.arguments.length === 1 &&
          mapFn.params.every((param) => param.type === "Identifier") &&
          sourceCode.scopeManager?.acquire(mapFn) != null;

        context.report({
          node,
          messageId: "preferFor",
          fix: canAutoFix
            ? (fixer) => {
                const jsxExpressionContainerNode = containerNode.parent as T.JSXExpressionContainer;
                const arrayNode = callee.object;
                const mapFnNode = node.arguments[0];
                const scope = sourceCode.scopeManager!.acquire(mapFn)!;
                const fixes = [
                  fixer.replaceTextRange(
                    [jsxExpressionContainerNode.range[0], arrayNode.range[0]],
                    "<For each={",
                  ),
                  fixer.replaceTextRange([arrayNode.range[1], mapFnNode.range[0]], "}>{"),
                  fixer.replaceTextRange(
                    [mapFnNode.range[1], jsxExpressionContainerNode.range[1]],
                    "}</For>",
                  ),
                ];

                for (const param of mapFn.params) {
                  if (param.type !== "Identifier") {
                    continue;
                  }

                  const variable = scope.set.get(param.name);
                  if (!variable) {
                    continue;
                  }

                  for (const reference of variable.references) {
                    if (reference.isReadOnly()) {
                      fixes.push(fixer.replaceText(reference.identifier, `${param.name}()`));
                    }
                  }
                }

                return fixes;
              }
            : undefined,
        });
      },
    };
  },
});
