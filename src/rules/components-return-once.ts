import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { getFunctionName } from "../utils.js";
import type { FunctionNode } from "../utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;

const isNothing = (node?: T.Node): boolean => {
  if (!node) {
    return true;
  }

  switch (node.type) {
    case "Literal":
      return ([null, undefined, false, ""] as unknown[]).includes(node.value);
    case "JSXFragment":
      return node.children.every((child) => isNothing(child));
    default:
      return false;
  }
};

const getLineLength = (loc: T.SourceLocation | null): number =>
  loc == null ? 0 : loc.end.line - loc.start.line + 1;

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow early returns in components. Solid components only run once, so conditionals should stay inside JSX.",
    },
    fixable: "code",
    schema: [],
    messages: {
      noConditionalReturn:
        "Solid components run once, so a conditional return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`.",
      noEarlyReturn:
        "Solid components run once, so an early return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`.",
    },
  },
  defaultOptions: [],
  create(context) {
    const functionStack: Array<{
      isComponent: boolean;
      lastReturn: T.ReturnStatement | undefined;
      earlyReturns: T.ReturnStatement[];
    }> = [];
    const sourceCode = context.sourceCode;

    const putIntoJSX = (node: T.Node): string => {
      const text = sourceCode.getText(node);
      return node.type === "JSXElement" || node.type === "JSXFragment" ? text : `{${text}}`;
    };

    const currentFunction = () => functionStack[functionStack.length - 1];

    const onFunctionEnter = (node: FunctionNode) => {
      let lastReturn: T.ReturnStatement | undefined;
      if (node.body.type === "BlockStatement") {
        const last = [...node.body.body]
          .reverse()
          .find((statement) => !statement.type.endsWith("Declaration"));
        if (last?.type === "ReturnStatement") {
          lastReturn = last;
        }
      }

      functionStack.push({ isComponent: false, lastReturn, earlyReturns: [] });
    };

    const onFunctionExit = (node: FunctionNode) => {
      const fn = currentFunction();
      if (
        getFunctionName(node)?.match(/^[a-z]/) ||
        node.parent?.type === "JSXExpressionContainer" ||
        (node.parent?.type === "CallExpression" &&
          node.type !== "FunctionDeclaration" &&
          node.parent.arguments.includes(node) &&
          !(node.parent.callee.type === "Identifier" && node.parent.callee.name.match(/^[A-Z]/)))
      ) {
        fn.isComponent = false;
      }

      if (fn.isComponent) {
        for (const earlyReturn of fn.earlyReturns) {
          context.report({
            node: earlyReturn,
            messageId: "noEarlyReturn",
          });
        }

        const argument = fn.lastReturn?.argument;
        if (argument?.type === "ConditionalExpression") {
          context.report({
            node: argument.parent ?? argument,
            messageId: "noConditionalReturn",
            fix: (fixer) => {
              const conditions = [{ test: argument.test, consequent: argument.consequent }];
              let fallback = argument.alternate;

              while (fallback.type === "ConditionalExpression") {
                conditions.push({ test: fallback.test, consequent: fallback.consequent });
                fallback = fallback.alternate;
              }

              if (conditions.length >= 2) {
                const fallbackText = !isNothing(fallback)
                  ? ` fallback={${sourceCode.getText(fallback)}}`
                  : "";
                return fixer.replaceText(
                  argument,
                  `<Switch${fallbackText}>\n${conditions
                    .map(
                      ({ test, consequent }) =>
                        `<Match when={${sourceCode.getText(test)}}>${putIntoJSX(consequent)}</Match>`,
                    )
                    .join("\n")}\n</Switch>`,
                );
              }

              if (isNothing(argument.consequent)) {
                return fixer.replaceText(
                  argument,
                  `<Show when={!(${sourceCode.getText(argument.test)})}>${putIntoJSX(argument.alternate)}</Show>`,
                );
              }

              if (
                isNothing(fallback) ||
                getLineLength(argument.consequent.loc) >= getLineLength(fallback.loc) * 1.5
              ) {
                const fallbackText = !isNothing(fallback)
                  ? ` fallback={${sourceCode.getText(fallback)}}`
                  : "";
                return fixer.replaceText(
                  argument,
                  `<Show when={${sourceCode.getText(argument.test)}}${fallbackText}>${putIntoJSX(argument.consequent)}</Show>`,
                );
              }

              return fixer.replaceText(argument, `<>${putIntoJSX(argument)}</>`);
            },
          });
        } else if (argument?.type === "LogicalExpression") {
          if (argument.operator === "&&") {
            context.report({
              node: argument,
              messageId: "noConditionalReturn",
            });
          } else {
            context.report({
              node: argument,
              messageId: "noConditionalReturn",
            });
          }
        }
      }

      functionStack.pop();
    };

    return {
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      JSXElement() {
        if (functionStack.length > 0) {
          currentFunction().isComponent = true;
        }
      },
      JSXFragment() {
        if (functionStack.length > 0) {
          currentFunction().isComponent = true;
        }
      },
      ReturnStatement(node) {
        if (functionStack.length > 0 && node !== currentFunction().lastReturn) {
          currentFunction().earlyReturns.push(node);
        }
      },
    };
  },
});
