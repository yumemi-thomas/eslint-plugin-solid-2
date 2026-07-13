import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, type FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { bindsToSolid, getSolidImportFixes, isComponent } from "./solid-rule-utils.js";

// A conditional/early return only breaks anything when its guard can *change* after the component's
// single run — i.e. when the guard performs a reactive read. A static guard (`isServer`,
// `import.meta.env.DEV`, a module constant) makes the return shape fixed at mount, which is correct
// Solid; flagging it was a false positive. We therefore report only guards that provably read
// reactive state: a member access rooted at the props parameter, a locally-declared signal/memo
// accessor call, a store member read, or a `const` derived from one of those. Guards we can't prove
// reactive (a helper call, a context read, an imported accessor) are tolerated false negatives.
const ACCESSOR_FACTORIES = new Set(["createMemo"]);
const PAIR_ACCESSOR_FACTORIES = new Set(["createSignal", "createOptimistic"]);
const STORE_FACTORIES = new Set(["createOptimisticStore", "createStore"]);

type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;

function getVariable(id: T.Identifier, context: RuleContext): TSESLint.Scope.Variable | null {
  return ASTUtils.findVariable(context.sourceCode.getScope(id), id);
}

/** The `VariableDeclarator` that declared `variable`, when it was declared by one. */
function getDeclarator(variable: TSESLint.Scope.Variable): T.VariableDeclarator | null {
  const def = variable.defs[0];
  return def?.type === "Variable" ? def.node : null;
}

/** Whether `variable` is `elements[0]` of an array-pattern declaration whose init calls a factory. */
function isPairElementZero(
  variable: TSESLint.Scope.Variable,
  factories: ReadonlySet<string>,
  context: RuleContext,
): boolean {
  const declarator = getDeclarator(variable);
  if (
    declarator?.id.type !== "ArrayPattern" ||
    declarator.init?.type !== "CallExpression" ||
    declarator.init.callee.type !== "Identifier"
  ) {
    return false;
  }
  const first = declarator.id.elements[0];
  return (
    first?.type === "Identifier" &&
    first.name === variable.name &&
    bindsToSolid(declarator.init.callee, context, factories)
  );
}

/** Whether calling `variable` reads a signal/memo accessor (follows `const c = count` aliases). */
function variableIsAccessor(
  variable: TSESLint.Scope.Variable,
  context: RuleContext,
  seen: Set<TSESLint.Scope.Variable>,
): boolean {
  if (seen.has(variable)) {
    return false;
  }
  seen.add(variable);

  if (isPairElementZero(variable, PAIR_ACCESSOR_FACTORIES, context)) {
    return true;
  }

  const declarator = getDeclarator(variable);
  if (declarator?.id.type !== "Identifier" || declarator.init == null) {
    return false;
  }
  if (
    declarator.init.type === "CallExpression" &&
    declarator.init.callee.type === "Identifier" &&
    bindsToSolid(declarator.init.callee, context, ACCESSOR_FACTORIES)
  ) {
    return true;
  }
  if (declarator.init.type === "Identifier") {
    const source = getVariable(declarator.init, context);
    return source != null && variableIsAccessor(source, context, seen);
  }
  return false;
}

/**
 * Whether evaluating `node` provably performs a reactive read from `componentFn`'s perspective.
 * Skips nested functions (not evaluated by the guard) and JSX (reads there compile to tracked
 * scopes). Follows one-level-and-deeper `const` derivations (`const loading = props.loading`).
 */
function containsReactiveRead(
  node: T.Node,
  componentFn: FunctionNode,
  context: RuleContext,
  seen: Set<TSESLint.Scope.Variable> = new Set(),
): boolean {
  const isPropsParameter = (variable: TSESLint.Scope.Variable): boolean =>
    variable.defs.some((def) => def.type === "Parameter" && def.node === componentFn);

  const memberRootIsReactive = (member: T.MemberExpression): boolean => {
    let root: T.Expression = member;
    while (root.type === "MemberExpression") {
      root = root.object;
    }
    if (root.type !== "Identifier") {
      return false;
    }
    const variable = getVariable(root, context);
    if (variable == null) {
      return false;
    }
    if (isPropsParameter(variable) || isPairElementZero(variable, STORE_FACTORIES, context)) {
      return true;
    }
    return derivedConstIsReactive(variable);
  };

  const derivedConstIsReactive = (variable: TSESLint.Scope.Variable): boolean => {
    if (seen.has(variable)) {
      return false;
    }
    seen.add(variable);
    const declarator = getDeclarator(variable);
    return (
      declarator?.id.type === "Identifier" &&
      declarator.init != null &&
      containsReactiveRead(declarator.init, componentFn, context, seen)
    );
  };

  const stack: T.Node[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;

    if (
      isFunctionNode(current) ||
      current.type === "JSXElement" ||
      current.type === "JSXFragment"
    ) {
      continue;
    }

    if (current.type === "CallExpression" && current.callee.type === "Identifier") {
      const callee = getVariable(current.callee, context);
      if (callee != null && variableIsAccessor(callee, context, new Set())) {
        return true;
      }
    }

    if (current.type === "MemberExpression" && memberRootIsReactive(current)) {
      return true;
    }

    if (current.type === "Identifier") {
      const variable = getVariable(current, context);
      if (variable != null && !isPropsParameter(variable) && derivedConstIsReactive(variable)) {
        return true;
      }
    }

    for (const key in current) {
      if (key === "parent" || key === "tokens" || key === "comments") {
        continue;
      }
      const value = (current as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (
            item != null &&
            typeof item === "object" &&
            typeof (item as T.Node).type === "string"
          ) {
            stack.push(item as T.Node);
          }
        }
      } else if (
        value != null &&
        typeof value === "object" &&
        typeof (value as T.Node).type === "string"
      ) {
        stack.push(value as T.Node);
      }
    }
  }

  return false;
}

/**
 * The guard expressions that decide whether execution reaches `ret`: every enclosing `if` test,
 * switch discriminant/case test, and loop condition between the return and the component function.
 */
function collectGuardExpressions(ret: T.ReturnStatement, fn: FunctionNode): T.Expression[] {
  const guards: T.Expression[] = [];
  let current: T.Node = ret;
  while (current !== fn && current.parent != null) {
    const parent: T.Node = current.parent;
    switch (parent.type) {
      case "IfStatement":
        if (parent.consequent === current || parent.alternate === current) {
          guards.push(parent.test);
        }
        break;
      case "SwitchCase":
        if (parent.test != null) {
          guards.push(parent.test);
        }
        break;
      case "SwitchStatement":
        guards.push(parent.discriminant);
        break;
      case "WhileStatement":
      case "DoWhileStatement":
        if (parent.body === current) {
          guards.push(parent.test);
        }
        break;
      case "ForStatement":
        if (parent.body === current && parent.test != null) {
          guards.push(parent.test);
        }
        break;
      case "ForInStatement":
      case "ForOfStatement":
        if (parent.body === current) {
          guards.push(parent.right);
        }
        break;
      default:
        break;
    }
    current = parent;
  }
  return guards;
}

/**
 * The decision expressions of a conditional last return: the tests of a (possibly nested) ternary
 * chain, or the left operands along a logical chain (`a && b && <X/>` → `a && b`). Branch values
 * are excluded — reads inside returned JSX are tracked and not this rule's concern.
 */
function conditionalDecisionExpressions(argument: T.Expression): T.Expression[] {
  const decisions: T.Expression[] = [];
  if (argument.type === "ConditionalExpression") {
    let current: T.Expression = argument;
    while (current.type === "ConditionalExpression") {
      decisions.push(current.test);
      current = current.alternate;
    }
  } else if (argument.type === "LogicalExpression") {
    let current: T.Expression = argument;
    while (current.type === "LogicalExpression") {
      decisions.push(current.left);
      current = current.right;
    }
  }
  return decisions;
}

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

interface FunctionFrame {
  node: FunctionNode;
  lastReturn: T.ReturnStatement | undefined;
  earlyReturns: T.ReturnStatement[];
}

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "noConditionalReturn" | "noEarlyReturn";

export default createRule<Options, MessageIds>({
  name: "components-return-once",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow early returns in components. Solid components only run once, so conditionals should stay inside JSX.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          // Opt in to type-aware analysis: also detect components used as `<C/>` in other files.
          // Requires ESLint type information and is slower; off by default.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noConditionalReturn:
        "Solid components run once, so a conditional return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`.",
      noEarlyReturn:
        "Solid components run once, so an early return breaks reactivity. Move the condition inside JSX, such as a fragment or `<Show />`.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const functionStack: FunctionFrame[] = [];

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

      functionStack.push({ node, lastReturn, earlyReturns: [] });
    };

    const onFunctionExit = () => {
      // The component index is complete (built from the whole file), so we can decide and report on
      // exit — by which point all of this function's returns have been collected.
      const frame = functionStack.pop();
      if (frame && isComponent(frame.node, context)) {
        reportComponent(frame);
      }
    };

    const reportComponent = (frame: FunctionFrame) => {
      // Only a *reactive* guard makes a return-shape decision that can go stale after the single
      // component run. Static guards (`isServer`, `import.meta.env.DEV`, module constants) and
      // guards we can't prove reactive are left alone — see the note on the factory sets above.
      const isReactiveGuard = (expression: T.Expression): boolean =>
        containsReactiveRead(expression, frame.node, context);

      for (const earlyReturn of frame.earlyReturns) {
        if (!collectGuardExpressions(earlyReturn, frame.node).some(isReactiveGuard)) {
          continue;
        }
        context.report({
          node: earlyReturn,
          messageId: "noEarlyReturn",
        });
      }

      const argument = frame.lastReturn?.argument;
      if (
        (argument?.type === "ConditionalExpression" || argument?.type === "LogicalExpression") &&
        !conditionalDecisionExpressions(argument).some(isReactiveGuard)
      ) {
        return;
      }
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

            // The rewrite may reference `<Switch>`/`<Match>`/`<Show>`; make sure they resolve to
            // solid-js (adding the import if needed) or skip the fix entirely — an autofix must
            // never produce code that doesn't compile or resolves to the wrong binding.
            const withImports = (
              names: readonly string[],
              replacement: TSESLint.RuleFix,
            ): TSESLint.RuleFix[] | null => {
              const importFixes = getSolidImportFixes(context, fixer, names);
              return importFixes == null ? null : [...importFixes, replacement];
            };

            if (conditions.length >= 2) {
              const fallbackText = !isNothing(fallback)
                ? ` fallback={${sourceCode.getText(fallback)}}`
                : "";
              return withImports(
                ["Switch", "Match"],
                fixer.replaceText(
                  argument,
                  `<Switch${fallbackText}>\n${conditions
                    .map(
                      ({ test, consequent }) =>
                        `<Match when={${sourceCode.getText(test)}}>${putIntoJSX(consequent)}</Match>`,
                    )
                    .join("\n")}\n</Switch>`,
                ),
              );
            }

            if (isNothing(argument.consequent)) {
              return withImports(
                ["Show"],
                fixer.replaceText(
                  argument,
                  `<Show when={!(${sourceCode.getText(argument.test)})}>${putIntoJSX(argument.alternate)}</Show>`,
                ),
              );
            }

            if (
              isNothing(fallback) ||
              getLineLength(argument.consequent.loc) >= getLineLength(fallback.loc) * 1.5
            ) {
              const fallbackText = !isNothing(fallback)
                ? ` fallback={${sourceCode.getText(fallback)}}`
                : "";
              return withImports(
                ["Show"],
                fixer.replaceText(
                  argument,
                  `<Show when={${sourceCode.getText(argument.test)}}${fallbackText}>${putIntoJSX(argument.consequent)}</Show>`,
                ),
              );
            }

            return fixer.replaceText(argument, `<>${putIntoJSX(argument)}</>`);
          },
        });
      } else if (argument?.type === "LogicalExpression") {
        context.report({
          node: argument,
          messageId: "noConditionalReturn",
        });
      }
    };

    return {
      FunctionDeclaration: onFunctionEnter,
      FunctionExpression: onFunctionEnter,
      ArrowFunctionExpression: onFunctionEnter,
      "FunctionDeclaration:exit": onFunctionExit,
      "FunctionExpression:exit": onFunctionExit,
      "ArrowFunctionExpression:exit": onFunctionExit,
      ReturnStatement(node) {
        if (functionStack.length > 0 && node !== currentFunction().lastReturn) {
          currentFunction().earlyReturns.push(node);
        }
      },
    };
  },
});
