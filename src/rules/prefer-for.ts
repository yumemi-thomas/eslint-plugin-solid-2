import { TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { isFunctionNode, isJSXElementOrFragment, trace } from "../utils.js";
import { createRule } from "./create-rule.js";
import {
  functionReturnsJsx,
  getArrayReceiverVerdict,
  getSolidImportFixes,
  getTypeAwareServices,
} from "./solid-rule-utils.js";

// Array methods that return a new array. A `.map` whose receiver chain bottoms out at an array
// literal through only these is as soundly static as the literal itself.
const PURE_ARRAY_TRANSFORMS = new Set([
  "filter",
  "slice",
  "concat",
  "map",
  "flat",
  "flatMap",
  "sort",
  "reverse",
  "toSorted",
  "toReversed",
  "toSpliced",
  "with",
]);

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "preferFor";

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

// Whether a `.map` receiver is a soundly-static array — constructed once, never reactive, so `<For>`
// would only add reconciliation overhead. Covers an array literal, a `const` bound to one, and a
// chain of pure array transforms over either (`["a"].filter(f)`, `ITEMS.slice(1)`). These are
// exempted exactly like a direct `[...].map(...)`.
function isStaticArrayReceiver(
  node: T.Node,
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
): boolean {
  if (node.type === "ArrayExpression") {
    return true;
  }

  if (node.type === "Identifier") {
    const traced = trace(node, context);
    return traced !== node && traced.type === "ArrayExpression";
  }

  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    PURE_ARRAY_TRANSFORMS.has(node.callee.property.name)
  ) {
    return isStaticArrayReceiver(node.callee.object, context);
  }

  return false;
}

// Whether a `.map(...)` call's result is rendered into JSX — directly (`{x.map(...)}`) or through
// a conditional whose value flows to the JSX slot (`{cond && x.map(...)}`, `{cond ? x.map(...) : y}`).
function isRenderedInJsx(node: T.Node): boolean {
  let current: T.Node = node;
  for (let parent = current.parent; parent != null; parent = current.parent) {
    if (parent.type === "ChainExpression") {
      // transparent
    } else if (
      parent.type === "LogicalExpression" &&
      parent.operator === "&&" &&
      parent.right === current
    ) {
      // `{cond && x.map(...)}`
    } else if (
      parent.type === "ConditionalExpression" &&
      (parent.consequent === current || parent.alternate === current)
    ) {
      // `{cond ? x.map(...) : ...}`
    } else if (parent.type === "JSXExpressionContainer") {
      return isJSXElementOrFragment(parent.parent);
    } else {
      return false;
    }
    current = parent;
  }
  return false;
}

export default createRule<Options, MessageIds>({
  name: "prefer-for",
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer Solid's <For /> component over Array#map when rendering JSX lists.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          // Opt in to type-aware analysis: skip the report when the `.map` receiver is provably not
          // an array (e.g. a Map/Set). Requires ESLint type information and is slower; off by default.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      preferFor:
        "Use Solid's `<For />` component for rendering JSX lists instead of `Array#map(...)`.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const typescriptEnabled = context.options[0]?.typescriptEnabled ?? false;

    return {
      CallExpression(node) {
        if (!isRenderedInJsx(node)) {
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

        // A soundly-static array receiver (`[...].map`, a `const` array, a chain of pure transforms
        // over either) is constructed once and never reactive, so `<For>` would only add
        // reconciliation overhead. Skip it.
        if (isStaticArrayReceiver(callee.object, context)) {
          return;
        }

        const mapFn = node.arguments[0];
        if (!isFunctionNode(mapFn) || !functionReturnsJsx(mapFn)) {
          return;
        }

        // With type info: skip the report entirely for a provably non-array receiver, and record
        // whether the receiver is *provably* an array — the autofix is gated on that below.
        let receiverVerdict: "array" | "not-array" | "unknown" = "unknown";
        if (typescriptEnabled) {
          const services = getTypeAwareServices(context);
          if (services) {
            receiverVerdict = getArrayReceiverVerdict(callee.object, services);
            if (receiverVerdict === "not-array") {
              return;
            }
          }
        }

        // The autofix only applies when the `.map` call fills the JSX slot directly (`{x.map(...)}`);
        // wrapped forms (`{cond && x.map(...)}`) are reported but left for the author to convert.
        // It additionally requires the receiver to be *provably* an array (type info): `<For each>`
        // on a non-array is semantically wrong, and "zero corrupting autofix" outranks fix coverage.
        // Under AST-only analysis the rule is therefore report-only.
        const containerNode = node.parent?.type === "ChainExpression" ? node.parent : node;
        const directContainer =
          containerNode.parent?.type === "JSXExpressionContainer" &&
          isJSXElementOrFragment(containerNode.parent.parent);
        const canAutoFix =
          receiverVerdict === "array" &&
          directContainer &&
          node.arguments.length === 1 &&
          mapFn.type === "ArrowFunctionExpression" &&
          mapFn.params.length <= 2 &&
          mapFn.params.every((param) => param.type === "Identifier") &&
          sourceCode.scopeManager?.acquire(mapFn) != null;

        // An unknown receiver may be an Observable/collection with an unrelated `.map` method.
        // Reporting it would violate the zero-false-positive contract; type-aware configuration is
        // the only sound way to recommend `<For>` for non-literal receivers.
        if (receiverVerdict !== "array") {
          return;
        }

        context.report({
          node,
          messageId: "preferFor",
          fix: canAutoFix
            ? (fixer) => {
                // The rewrite references `<For>`; make sure it resolves to solid-js or skip the fix.
                const importFixes = getSolidImportFixes(context, fixer, ["For"]);
                if (importFixes == null) {
                  return null;
                }

                const jsxExpressionContainerNode = containerNode.parent as T.JSXExpressionContainer;
                const arrayNode = callee.object;
                const mapFnNode = node.arguments[0];
                const scope = sourceCode.scopeManager!.acquire(mapFn)!;
                const fixes = [
                  ...importFixes,
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

                // In Solid 2's default `<For>`, the item callback param is a raw value but the
                // index param is an `Accessor<number>`. So leave item references untouched and
                // call only the index (second) param's references.
                const indexParam = mapFn.params[1];
                if (indexParam?.type === "Identifier") {
                  const variable = scope.set.get(indexParam.name);
                  if (variable) {
                    for (const reference of variable.references) {
                      if (reference.isReadOnly()) {
                        fixes.push(fixer.replaceText(reference.identifier, `${indexParam.name}()`));
                      }
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
