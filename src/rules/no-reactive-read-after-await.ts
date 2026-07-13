import * as ts from "typescript";
import { ASTUtils, TSESLint, TSESTree as T } from "@typescript-eslint/utils";
import { createRule } from "./create-rule.js";
import {
  bindsToSolid,
  getNearestFunctionAncestor,
  getTypeAwareServices,
  isSolidApiCallbackArgument,
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
]);

// Factories whose single result is a signal/memo accessor, called as `value()`.
const ACCESSOR_FACTORIES = new Set(["createMemo"]);
// Factories returning a `[getter, setter]` pair; only the getter (element 0) is an accessor.
const PAIR_ACCESSOR_FACTORIES = new Set(["createSignal", "createOptimistic"]);

// Solid's reactive-getter type aliases. A call whose callee's *type* is one of these (and originates
// from solid) is a tracked read — the type-aware path's nominal signal, used in place of the
// AST path's "result of a known factory call" so member/param/imported accessors are seen too.
// `Accessor<T>` is the public/annotation form (`() => T`); `SourceAccessor<T>` (`Refreshable<
// Accessor<T>>`) is the inferred type of signal/memo getters in Solid 2.0, so both must be matched.
const SOLID_ACCESSOR_TYPE_NAMES = new Set(["Accessor", "SourceAccessor"]);

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

// Flatten a type into the constituents worth inspecting: the type itself plus, recursively, the
// members of any union/intersection. This lets a decorated ecosystem accessor — e.g. a router's
// `AccessorWithLatest<T> = Accessor<T> & { latest: T }` — be recognized by the solid `Accessor`
// member of its intersection, even though the outer alias name is the library's own.
function collectTypeParts(
  type: ts.Type,
  acc: ts.Type[] = [],
  seen = new Set<ts.Type>(),
): ts.Type[] {
  if (seen.has(type)) {
    return acc;
  }
  seen.add(type);
  acc.push(type);
  if (type.isUnion() || type.isIntersection()) {
    for (const member of type.types) {
      collectTypeParts(member, acc, seen);
    }
  }
  return acc;
}

// Whether a TS symbol is declared by solid. Mirrors the AST side's "binding must resolve to solid"
// rule (ADR-0003), so a same-named non-solid `Accessor`/factory is never treated as reactive.
function symbolIsFromSolid(symbol: ts.Symbol, checker: ts.TypeChecker): boolean {
  // Solid's reactive types/primitives live in `@solidjs/signals`, re-exported through `solid-js`
  // (and `solid-signals` in the monorepo). Match any of those origins, by fully-qualified name or by
  // declaration file. The FQN carries the module for module-exported symbols; the declaration-file
  // fallback covers cases where the symbol has no `declarations` exposed (e.g. some `projectService`
  // setups) or the FQN is unqualified.
  const isSolidOrigin = (text: string): boolean =>
    text.includes("solid-js") || text.includes("@solidjs") || text.includes("solid-signals");
  if (isSolidOrigin(checker.getFullyQualifiedName(symbol))) {
    return true;
  }
  for (const declaration of symbol.getDeclarations() ?? []) {
    if (isSolidOrigin(declaration.getSourceFile().fileName)) {
      return true;
    }
  }
  return false;
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
    const checker = services?.program.getTypeChecker() ?? null;

    // Variables that hold a signal/memo accessor, resolved by binding (so `const c = count` aliases
    // are tracked too). Populated as declarations are visited; declarations precede uses in source,
    // so the set is complete by the time an accessor call inside a callback body is checked.
    const accessorVars = new Set<TSESLint.Scope.Variable>();
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
      if (!services || !checker) {
        return false;
      }
      const parent = fn.parent;
      if (parent?.type !== "CallExpression" || parent.arguments[0] !== fn) {
        return false;
      }
      const calleeNode = services.esTreeNodeToTSNodeMap.get(parent.callee);
      if (!calleeNode) {
        return false;
      }
      let symbol = checker.getSymbolAtLocation(calleeNode);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
        symbol = checker.getAliasedSymbol(symbol);
      }
      return (
        symbol != null &&
        COMPUTE_FACTORIES.has(symbol.getName()) &&
        symbolIsFromSolid(symbol, checker)
      );
    }

    function isComputeCallback(fn: FunctionNode): boolean {
      const cached = computeCallbackCache.get(fn);
      if (cached !== undefined) {
        return cached;
      }
      const result =
        isSolidApiCallbackArgument(fn, 0, context, COMPUTE_FACTORIES) ||
        isTypeAwareComputeCallback(fn);
      computeCallbackCache.set(fn, result);
      return result;
    }

    // Type-aware: whether `callee`'s type is a solid reactive-getter (`Accessor`). Checks the type
    // and, for `Accessor<T> | undefined`-style unions, its members; the alias must originate from
    // solid, so a plain `() => T` (structurally identical but not the solid alias) is left alone.
    function isSolidAccessorCallee(callee: T.Expression): boolean {
      if (!services || !checker) {
        return false;
      }
      const calleeNode = services.esTreeNodeToTSNodeMap.get(callee);
      if (!calleeNode) {
        return false;
      }
      const type = checker.getTypeAtLocation(calleeNode);
      return collectTypeParts(type).some((part) => {
        const alias = part.aliasSymbol;
        return (
          alias != null &&
          SOLID_ACCESSOR_TYPE_NAMES.has(alias.getName()) &&
          symbolIsFromSolid(alias, checker)
        );
      });
    }

    // The accessor's display name, or null when `call` is not a read of a reactive accessor. AST
    // first (an identifier bound to a known factory result, including `const` aliases); then, only
    // with type info, an identifier or member whose type is a solid `Accessor`.
    function accessorReadName(call: T.CallExpression): string | null {
      if (call.callee.type === "Identifier") {
        const variable = ASTUtils.findVariable(sourceCode.getScope(call), call.callee);
        if (variable && accessorVars.has(variable)) {
          return call.callee.name;
        }
      }
      if (services && isSolidAccessorCallee(call.callee)) {
        return sourceCode.getText(call.callee);
      }
      return null;
    }

    return {
      VariableDeclarator(node) {
        // const value = createMemo(...) / createAsync(...) / createProjection(...)
        if (
          node.id.type === "Identifier" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          bindsToSolid(node.init.callee, context, ACCESSOR_FACTORIES)
        ) {
          const variable = ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
          if (variable) {
            accessorVars.add(variable);
          }
          return;
        }

        // const [value] = createSignal(...) / createOptimistic(...)
        if (
          node.id.type === "ArrayPattern" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          bindsToSolid(node.init.callee, context, PAIR_ACCESSOR_FACTORIES)
        ) {
          const first = node.id.elements[0];
          if (first?.type === "Identifier") {
            const variable = sourceCode.scopeManager
              ?.getDeclaredVariables(node)
              .find((declared) => declared.name === first.name);
            if (variable) {
              accessorVars.add(variable);
            }
          }
          return;
        }

        // const c = count  (alias of a known accessor)
        if (node.id.type === "Identifier" && node.init?.type === "Identifier") {
          const source = ASTUtils.findVariable(sourceCode.getScope(node.init), node.init);
          if (source && accessorVars.has(source)) {
            const target = ASTUtils.findVariable(sourceCode.getScope(node.id), node.id);
            if (target) {
              accessorVars.add(target);
            }
          }
        }
      },

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
