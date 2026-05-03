import { ESLintUtils, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, trace } from "../utils.js";
import { collectSolidAliases, matchesSolidName } from "./solid-rule-utils.js";

const createRule = ESLintUtils.RuleCreator.withoutDocs;
const MEMO_NAMES = new Set(["createMemo"]);
const EFFECT_NAMES = new Set(["createEffect", "createRenderEffect"]);

type Kind = "memo" | "effect";

function resolveSolidFactory(
  callee: T.Expression,
  context: Parameters<typeof trace>[1],
  aliases: ReadonlySet<string>,
  canonical: ReadonlySet<string>,
): boolean {
  if (callee.type !== "Identifier") {
    return false;
  }

  if (matchesSolidName(callee.name, aliases, canonical)) {
    return true;
  }

  const traced = trace(callee, context);
  if (traced.type === "Identifier" && canonical.has(traced.name)) {
    return true;
  }

  return (
    traced.type === "ImportSpecifier" &&
    traced.parent?.type === "ImportDeclaration" &&
    traced.parent.source.type === "Literal" &&
    traced.parent.source.value === "solid-js" &&
    traced.imported.type === "Identifier" &&
    canonical.has(traced.imported.name)
  );
}

export default createRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow React-style dependency arrays in Solid computations.",
    },
    fixable: "code",
    schema: [],
    messages: {
      noReactDepsMemo:
        "Solid 2 does not use dependency arrays here. Put dependencies in the compute phase instead.",
      noReactDepsEffect:
        "Solid 2's `{{name}}` takes the apply callback or an `EffectBundle` as its second argument, not a dependency array. Track dependencies in the compute phase and move side effects into the apply callback.",
    },
  },
  defaultOptions: [],
  create(context) {
    const memoAliases = new Set<string>();
    const effectAliases = new Set<string>();

    return {
      ImportDeclaration(node) {
        collectSolidAliases(node, MEMO_NAMES, memoAliases);
        collectSolidAliases(node, EFFECT_NAMES, effectAliases);
      },
      CallExpression(node) {
        if (node.callee.type !== "Identifier") {
          return;
        }

        let kind: Kind | null = null;
        if (resolveSolidFactory(node.callee, context, memoAliases, MEMO_NAMES)) {
          kind = "memo";
        } else if (resolveSolidFactory(node.callee, context, effectAliases, EFFECT_NAMES)) {
          kind = "effect";
        }

        if (kind == null) {
          return;
        }

        if (
          node.arguments.length !== 2 ||
          node.arguments.some((argument) => argument.type === "SpreadElement")
        ) {
          return;
        }

        const [firstArg, secondArg] = node.arguments.map((argument) => trace(argument, context));
        if (!isFunctionNode(firstArg) || secondArg.type !== "ArrayExpression") {
          return;
        }

        if (kind === "memo") {
          context.report({
            node: node.arguments[1],
            messageId: "noReactDepsMemo",
            // Only autofix when the array literal is in source position; never autofix
            // createEffect/createRenderEffect because removing the array would leave the
            // deprecated 1.x single-arg form.
            fix:
              secondArg === node.arguments[1]
                ? (fixer) => fixer.removeRange([firstArg.range[1], node.range[1] - 1])
                : undefined,
          });
          return;
        }

        context.report({
          node: node.arguments[1],
          messageId: "noReactDepsEffect",
          data: { name: node.callee.name },
        });
      },
    };
  },
});
