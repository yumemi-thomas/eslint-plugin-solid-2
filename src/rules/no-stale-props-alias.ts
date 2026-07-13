import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { getControlFlowFunctionChildren } from "../analysis/control-flow-children.js";
import { findReactiveRead, getReactiveReadTypeServices } from "../analysis/reactive-reads.js";
import { isFunctionNode, type FunctionNode } from "../utils.js";
import { createRule } from "./create-rule.js";
import { bindsToSolid, isComponent } from "./solid-rule-utils.js";

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "stalePropsAlias" | "stalePropsRead" | "staleReactiveRead";
const UNTRACK_NAMES = new Set(["untrack"]);
// `merge(defaults, props)` / `omit(props, ...keys)` are the canonical 2.0 defaults/rest patterns:
// both return a *reactive* proxy over the props object, so passing `props` to them is a reactive
// passthrough, not a stale read. Their results are props-like and are tracked as aliases below.
const PROPS_HELPER_NAMES = new Set(["merge", "omit"]);

function isPropsVariableIdentifier(
  node: T.Node,
  propsVariables: ReadonlySet<TSESLint.Scope.Variable>,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (node.type !== "Identifier") {
    return false;
  }
  const variable = ASTUtils.findVariable(sourceCode.getScope(node), node);
  return variable != null && propsVariables.has(variable);
}

/**
 * Whether the expression, evaluated at the component's top level, performs an *eager read* of the
 * props object: a member access rooted at a props variable (`props.name`, `alias.user.name`,
 * `props[key]`) or a spread of it (`{ ...props }` reads every property). A *bare* props reference
 * is not a read — passing the object around (`merge(defaults, props)`, `omit(props, "class")`,
 * `const alias = props`) keeps reactivity intact, and treating it as one flagged the canonical
 * merge/omit patterns. A callee that might read eagerly (`format(props)`) is undecidable and is a
 * tolerated false negative.
 */
function expressionContainsPropsRead(
  node: T.Node,
  propsVariables: ReadonlySet<TSESLint.Scope.Variable>,
  sourceCode: TSESLint.SourceCode,
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
  const stack: T.Node[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;

    if (isFunctionNode(current)) {
      continue;
    }

    if (current.type === "CallExpression" && current.arguments[0] != null) {
      if (
        current.callee.type === "Identifier" &&
        bindsToSolid(current.callee, context, UNTRACK_NAMES)
      ) {
        const untracked = current.arguments[0];
        for (const child of getChildNodes(current)) {
          if (child !== untracked) {
            stack.push(child);
          }
        }
        continue;
      }
    }

    if (current.type === "MemberExpression") {
      let root: T.Expression = current;
      while (root.type === "MemberExpression") {
        root = root.object;
      }
      if (isPropsVariableIdentifier(root, propsVariables, sourceCode)) {
        return true;
      }
    }

    if (
      current.type === "SpreadElement" &&
      isPropsVariableIdentifier(current.argument, propsVariables, sourceCode)
    ) {
      return true;
    }

    stack.push(...getChildNodes(current));
  }

  return false;
}

/**
 * Whether `init` is a `merge(...)`/`omit(...)` call (bound to solid-js) that receives the props
 * object as a bare argument — the canonical defaults/rest pattern whose result is a reactive
 * props-like proxy.
 */
function isPropsHelperAliasInit(
  init: T.Expression,
  propsVariables: ReadonlySet<TSESLint.Scope.Variable>,
  sourceCode: TSESLint.SourceCode,
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
  if (
    init.type !== "CallExpression" ||
    init.callee.type !== "Identifier" ||
    !bindsToSolid(init.callee, context, PROPS_HELPER_NAMES)
  ) {
    return false;
  }

  return init.arguments.some((argument) => {
    if (argument.type !== "Identifier") {
      return false;
    }
    const variable = ASTUtils.findVariable(sourceCode.getScope(argument), argument);
    return variable != null && propsVariables.has(variable);
  });
}

function getDeclaredIdentifierVariable(
  declaration: T.VariableDeclarator,
  sourceCode: TSESLint.SourceCode,
): TSESLint.Scope.Variable | null {
  if (declaration.id.type !== "Identifier") {
    return null;
  }
  const id = declaration.id;

  return (
    sourceCode.scopeManager
      ?.getDeclaredVariables(declaration)
      .find((variable) => variable.name === id.name) ?? null
  );
}

function hasWriteAfterInit(variable: TSESLint.Scope.Variable): boolean {
  return variable.references.some((reference) => !reference.init && reference.isWrite());
}

function getAssignmentExpression(statement: T.Statement): T.AssignmentExpression | null {
  if (statement.type !== "ExpressionStatement") {
    return null;
  }

  const expression = statement.expression;
  return expression.type === "AssignmentExpression" &&
    expression.operator === "=" &&
    expression.left.type === "Identifier"
    ? expression
    : null;
}

function getChildNodes(node: T.Node): T.Node[] {
  const children: T.Node[] = [];
  for (const key in node) {
    if (key === "parent" || key === "tokens" || key === "comments") {
      continue;
    }

    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null && typeof item === "object" && typeof (item as T.Node).type === "string") {
          children.push(item as T.Node);
        }
      }
    } else if (
      value != null &&
      typeof value === "object" &&
      typeof (value as T.Node).type === "string"
    ) {
      children.push(value as T.Node);
    }
  }
  return children;
}

export default createRule<Options, MessageIds>({
  name: "no-stale-props-alias",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow provable untracked reactive reads in component and Solid control-flow structure-building scopes.",
    },
    schema: [
      {
        type: "object",
        properties: {
          // Opt in to type-aware component detection, mirroring no-destructure. The rule remains
          // AST/scope-only once a component has been identified.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      stalePropsAlias:
        "`{{name}}` aliases a prop read outside tracking. Read from `props` in JSX or a tracked scope instead.",
      stalePropsRead:
        "This prop is read directly in a Solid control-flow function child, where it will not update. Read it inside returned JSX or an explicit tracked scope instead.",
      staleReactiveRead:
        "Reactive state is read directly in a component or Solid control-flow function child, where it will not update. Read it inside JSX, a reactive computation, or explicit `untrack()` instead.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const typescript = getReactiveReadTypeServices(context);

    const checkFunction = (node: FunctionNode): void => {
      if (!isComponent(node, context)) {
        return;
      }

      const props = node.params[0];
      if (node.params.length > 1 || (props != null && props.type !== "Identifier")) {
        return;
      }

      const propsVariables = new Set<TSESLint.Scope.Variable>();
      if (props?.type === "Identifier") {
        const propsVariable = ASTUtils.findVariable(sourceCode.getScope(props), props);
        if (propsVariable == null) {
          return;
        }
        propsVariables.add(propsVariable);
      }

      const environment = { propsVariables, typescript };

      for (const statement of node.body.type === "BlockStatement" ? node.body.body : []) {
        if (statement.type === "VariableDeclaration") {
          for (const declaration of statement.declarations) {
            const aliasId = declaration.id;
            if (declaration.init == null) {
              continue;
            }
            if (aliasId.type !== "Identifier") {
              const read = findReactiveRead(declaration, environment, context);
              if (read) {
                context.report({ node: read.node, messageId: "staleReactiveRead" });
              }
              continue;
            }

            // A whole-object alias (`const alias = props`) or a `merge`/`omit` result is itself a
            // reactive props-like proxy — no read has happened, so don't report, but track it so a
            // later top-level read from it (`const size = alias.size`) is still caught.
            const isPropsLikeAlias =
              isPropsVariableIdentifier(declaration.init, propsVariables, sourceCode) ||
              isPropsHelperAliasInit(declaration.init, propsVariables, sourceCode, context);

            if (
              !expressionContainsPropsRead(declaration.init, propsVariables, sourceCode, context)
            ) {
              if (isPropsLikeAlias) {
                const declared = getDeclaredIdentifierVariable(declaration, sourceCode);
                if (declared != null && !hasWriteAfterInit(declared)) {
                  propsVariables.add(declared);
                }
              }
              const read = findReactiveRead(declaration.init, environment, context);
              if (read) {
                context.report({ node: read.node, messageId: "staleReactiveRead" });
              }
              continue;
            }

            const declared = getDeclaredIdentifierVariable(declaration, sourceCode);
            const isStableAlias = declared != null && !hasWriteAfterInit(declared);

            if (statement.kind === "const" || isStableAlias) {
              context.report({
                node: declaration,
                messageId: "stalePropsAlias",
                data: { name: aliasId.name },
              });
            }

            if (isStableAlias) {
              propsVariables.add(declared);
            }
          }
          continue;
        }

        const expression = getAssignmentExpression(statement);
        if (expression == null || expression.left.type !== "Identifier") {
          const read = findReactiveRead(statement, environment, context);
          if (read) {
            context.report({ node: read.node, messageId: "staleReactiveRead" });
          }
          continue;
        }
        const assigned = expression.left;

        if (!expressionContainsPropsRead(expression.right, propsVariables, sourceCode, context)) {
          const read = findReactiveRead(expression.right, environment, context);
          if (read) {
            context.report({ node: read.node, messageId: "staleReactiveRead" });
          }
          continue;
        }

        context.report({
          node: expression,
          messageId: "stalePropsAlias",
          data: { name: assigned.name },
        });
      }

      for (const child of getControlFlowFunctionChildren(node, context)) {
        const accessorVariables = new Set<TSESLint.Scope.Variable>();
        for (const parameter of child.accessorParameters) {
          const variable = ASTUtils.findVariable(sourceCode.getScope(parameter), parameter);
          if (variable) {
            accessorVariables.add(variable);
          }
        }
        const read = findReactiveRead(
          child.function.body,
          { propsVariables, accessorVariables, typescript },
          context,
        );
        if (read) {
          context.report({
            node: read.node,
            messageId: read.kind === "props" ? "stalePropsRead" : "staleReactiveRead",
          });
        }
      }
    };

    return {
      "FunctionDeclaration:exit": checkFunction,
      "FunctionExpression:exit": checkFunction,
      "ArrowFunctionExpression:exit": checkFunction,
    };
  },
});
