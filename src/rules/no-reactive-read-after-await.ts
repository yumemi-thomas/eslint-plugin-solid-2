import { TSESTree as T } from "@typescript-eslint/utils";
import { getReactiveBindingFact } from "../analysis/solid-bindings.js";
import {
  ASYNC_TRACKED_COMPUTE_ROLES,
  getComputationCallbackRole,
} from "../analysis/computation-roles.js";
import {
  isSolidAccessorExpression,
  isTypeAwareSolidCallee,
} from "../analysis/typescript-semantics.js";
import { createRule } from "./create-rule.js";
import {
  getNearestFunctionAncestor,
  getTypeAwareServices,
  type TypeAwareServices,
} from "./solid-rule-utils.js";
import { type FunctionNode } from "../utils.js";

// Reactive primitives whose FIRST argument is the tracked *compute* callback. Dependency tracking
// runs synchronously around that callback: the framework sets `tracking = true`, calls the function,
// and tears it back down the instant the function returns. For an `async` callback, that return
// happens at the first `await` — so any accessor read in the post-await continuation runs with
// `tracking === false` and silently fails to subscribe (the same root cause as
// `STRICT_READ_UNTRACKED`). The read still returns a value, so nothing breaks loudly; the computation
// just never re-runs when that signal changes. See docs/no-reactive-read-after-await.md.
//
// Solid 2.0 has no dedicated `createAsync`: the async primitive is an async compute function passed
// to one of these. `createProjection` is included as a compute (its draft callback runs tracked) but
// is NOT an accessor factory — it returns a Store proxy, not a callable accessor.
const COMPUTE_FACTORIES = new Set([
  "createMemo",
  "createEffect",
  "createRenderEffect",
  "createProjection",
  "createSignal",
  "createStore",
]);

type Options = [{ typescriptEnabled?: boolean }?];
type MessageIds = "reactiveReadAfterAwait";

// Whether an expression, evaluated unconditionally, is *guaranteed* to evaluate an `await`. Kept
// deliberately sound (zero false positives) over complete: it covers the shapes that always run the
// await — a bare `await x`, an assignment `x = await y`, a sequence, and an await passed as a call
// argument or callee (`f(await g())`, `(await getFn())()`). It stops at nested functions (their
// awaits don't suspend this one) and never descends into short-circuiting/conditional positions, so
// patterns like `cond && (await x)` are treated as "not guaranteed" rather than risk a false alarm.
function hasGuaranteedAwait(node: T.Node | null | undefined): boolean {
  if (node == null) {
    return false;
  }
  switch (node.type) {
    case "AwaitExpression":
      return true;
    case "SequenceExpression":
      return node.expressions.some(hasGuaranteedAwait);
    case "ArrayExpression":
      return node.elements.some(hasGuaranteedAwait);
    case "ObjectExpression":
      return node.properties.some((property) => {
        if (property.type === "SpreadElement") {
          return hasGuaranteedAwait(property.argument);
        }
        return (
          (property.computed && hasGuaranteedAwait(property.key)) ||
          hasGuaranteedAwait(property.value)
        );
      });
    case "TemplateLiteral":
      return node.expressions.some(hasGuaranteedAwait);
    case "TaggedTemplateExpression":
      return hasGuaranteedAwait(node.tag) || hasGuaranteedAwait(node.quasi);
    case "UnaryExpression":
      return hasGuaranteedAwait(node.argument);
    case "BinaryExpression":
      return hasGuaranteedAwait(node.left) || hasGuaranteedAwait(node.right);
    case "AssignmentExpression":
      return hasGuaranteedAwait(node.right);
    case "NewExpression":
      return hasGuaranteedAwait(node.callee) || node.arguments.some(hasGuaranteedAwait);
    case "CallExpression":
      // `a?.(...)` only calls when `a` is non-nullish — the argument awaits are then conditional.
      if (node.optional) {
        return false;
      }
      return hasGuaranteedAwait(node.callee) || node.arguments.some(hasGuaranteedAwait);
    default:
      return false;
  }
}

// Whether executing `stmt` is guaranteed to evaluate an `await` — the statement-level analogue of
// {@link hasGuaranteedAwait}. Only the unconditional statement forms count; an `if`/loop/`try` body
// is conditional, so awaits buried inside one are not treated as guaranteed (a tolerated false
// negative that keeps the rule sound — see the docs' Limitations section).
function statementGuaranteesAwait(stmt: T.Statement): boolean {
  switch (stmt.type) {
    case "ExpressionStatement":
      return hasGuaranteedAwait(stmt.expression);
    case "VariableDeclaration":
      return stmt.declarations.some((declarator) => hasGuaranteedAwait(declarator.init));
    case "BlockStatement":
      return stmt.body.some(statementGuaranteesAwait);
    default:
      return false;
  }
}

export default createRule<Options, MessageIds>({
  name: "no-reactive-read-after-await",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading reactive state (signal/memo accessors) after an `await` in an async reactive computation, where it is no longer tracked as a dependency.",
    },
    schema: [
      {
        type: "object",
        properties: {
          // Purely additive (ADR-0005): with type information the rule additionally recognizes
          // accessors reached by type (member/param/imported accessors) and member/namespace factory
          // calls. The AST analysis below always runs; this only finds *more*, never fewer.
          typescriptEnabled: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      reactiveReadAfterAwait:
        "Signal '{{name}}' is read after an `await` in this reactive computation. Reactive tracking ends at the first await, so this read does not register a dependency and the computation won't re-run when '{{name}}' changes. Read it before the await, or wrap it in `untrack()` if that's intentional.",
    },
  },
  defaultOptions: [{}],
  create(context) {
    const sourceCode = context.sourceCode;
    const typescriptEnabled = context.options[0]?.typescriptEnabled ?? false;
    const services: TypeAwareServices | null = typescriptEnabled
      ? getTypeAwareServices(context)
      : null;

    // Memoizes the compute-callback verdict per function — multiple reads in one callback (and the
    // type-aware factory lookup) then cost nothing after the first.
    const computeCallbackCache = new Map<FunctionNode, boolean>();

    // Whether `call` executes after a guaranteed `await` within `fn`. Walks from the read up to the
    // function: at every enclosing block (and comma-sequence), any earlier sibling that guarantees an
    // await dominates the read — reaching the read means those earlier siblings already ran. Earlier
    // siblings at *any* ancestor level count, since descending into a nested statement still runs the
    // outer block's preceding statements first.
    function isAfterAwait(call: T.Node, fn: FunctionNode): boolean {
      let current: T.Node = call;
      while (current !== fn && current.parent != null) {
        const parent = current.parent;
        if (parent.type === "BlockStatement" || parent.type === "StaticBlock") {
          const index = parent.body.indexOf(current as T.Statement);
          for (let i = 0; i < index; i++) {
            if (statementGuaranteesAwait(parent.body[i])) {
              return true;
            }
          }
        } else if (parent.type === "SequenceExpression") {
          const index = parent.expressions.indexOf(current as T.Expression);
          for (let i = 0; i < index; i++) {
            if (hasGuaranteedAwait(parent.expressions[i])) {
              return true;
            }
          }
        }
        current = parent;
      }
      return false;
    }

    // Type-aware: whether `fn` is the compute argument of a solid factory whose callee the AST path
    // can't match — a member/namespace call (`solid.createAsync(...)`) or an indirection trace can't
    // follow. Resolves the callee's symbol and checks it is a solid factory export.
    function isTypeAwareComputeCallback(fn: FunctionNode): boolean {
      if (!services) {
        return false;
      }
      const parent = fn.parent;
      if (parent?.type !== "CallExpression" || parent.arguments[0] !== fn) {
        return false;
      }
      return isTypeAwareSolidCallee(parent.callee, services, COMPUTE_FACTORIES);
    }

    function isComputeCallback(fn: FunctionNode): boolean {
      const cached = computeCallbackCache.get(fn);
      if (cached !== undefined) {
        return cached;
      }
      const result =
        (() => {
          const role = getComputationCallbackRole(fn, context);
          return role != null && ASYNC_TRACKED_COMPUTE_ROLES.has(role);
        })() || isTypeAwareComputeCallback(fn);
      computeCallbackCache.set(fn, result);
      return result;
    }

    // Type-aware: whether `callee`'s type is a solid reactive-getter (`Accessor`). Checks the type
    // and, for `Accessor<T> | undefined`-style unions, its members; the alias must originate from
    // solid, so a plain `() => T` (structurally identical but not the solid alias) is left alone.
    function isSolidAccessorCallee(callee: T.Expression): boolean {
      if (!services) {
        return false;
      }
      return isSolidAccessorExpression(callee, services);
    }

    // The accessor's display name, or null when `call` is not a read of a reactive accessor. AST
    // first (an identifier bound to a known factory result, including `const` aliases); then, only
    // with type info, an identifier or member whose type is a solid `Accessor`.
    function accessorReadName(call: T.CallExpression): string | null {
      if (call.callee.type === "Identifier") {
        if (getReactiveBindingFact(call.callee, context)?.role === "accessor") {
          return call.callee.name;
        }
      }
      if (services && isSolidAccessorCallee(call.callee)) {
        return sourceCode.getText(call.callee);
      }
      return null;
    }

    return {
      CallExpression(node) {
        // The read must sit directly in an async compute callback — not a nested closure (whose
        // invocation timing we can't know) and not the *apply* callback of an effect (arg 1, already
        // covered by `no-untracked-read-in-effect-apply`). The nearest-function check yields exactly
        // that: a read wrapped in `untrack(() => ...)` resolves to the untrack arrow, which is not a
        // compute callback, so it is correctly left alone. Cheap checks gate the type queries.
        const fn = getNearestFunctionAncestor(node);
        if (!fn || !fn.async || !isComputeCallback(fn) || !isAfterAwait(node, fn)) {
          return;
        }

        const name = accessorReadName(node);
        if (name == null) {
          return;
        }

        context.report({
          node,
          messageId: "reactiveReadAfterAwait",
          data: { name },
        });
      },
    };
  },
});
