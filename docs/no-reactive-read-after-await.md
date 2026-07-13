# `solid/no-reactive-read-after-await`

Disallow reading a signal/memo accessor **after an `await`** inside an async reactive computation, where it is no longer tracked as a dependency.

Solid registers dependencies **synchronously**: when a computation runs, tracking is enabled, the compute function is called, and tracking is torn down the instant it returns. For an `async` compute function, that return happens at the **first `await`** — it hands back a promise and the tracking context is gone. Any accessor read in the continuation after the await runs untracked: it still returns a value, so nothing breaks loudly, but it never records a dependency, so the computation **won't re-run when that signal changes**.

Solid 2.0 has no dedicated `createAsync` primitive — the async primitive is an `async` compute function passed to `createMemo`, `createEffect`, `createRenderEffect`, or `createProjection`. This rule checks the compute callback (the first argument) of each.

## Bad

```ts
const [count, setCount] = createSignal(0);

const data = createMemo(async () => {
  const res = await fetch(`/api?since=${lastSync}`);
  return (await res.json()).filter((x) => x.id > count()); // ❌ count() after await — not tracked
});
```

```ts
createEffect(async () => {
  await ready();
  console.log(count()); // ❌ count() after await — the effect won't re-run when count changes
});
```

## Good

Read what you need **before** the first `await`, then use the captured value:

```ts
const [count, setCount] = createSignal(0);

const data = createMemo(async () => {
  const min = count(); // ✅ tracked
  const res = await fetch(`/api?since=${lastSync}`);
  return (await res.json()).filter((x) => x.id > min);
});
```

If reading after the await is genuinely intentional (you do **not** want it to be a dependency), make that explicit with `untrack()`:

```ts
createMemo(async () => {
  await ready();
  return untrack(() => count()); // ✅ explicitly untracked
});
```

## Why not a runtime warning?

In the browser there is no reliable way to detect this at runtime: once an async function yields at `await`, native `await` resumes through the engine's internal machinery (not `Promise.prototype.then`), and there is no `AsyncContext` yet — so a post-await read is indistinguishable from any other untracked read (an event handler, `untrack`). Static analysis sees the source directly, which is why this is a lint rule.

## Type-aware mode (additive)

By default the rule is **AST-only**: it tracks accessors that come from a recognizable factory call
in the same file (`createSignal`/`createMemo`/`createOptimistic`, plus `const` aliases). Async compute
callbacks are recognized for effects, memos, projections, and derived signal/store factories,
including direct, aliased, and namespace `solid-js` imports. With type information enabled (the
`recommendedTypeChecked` config, or `{ typescriptEnabled: true }`), it additionally recognizes
accessors **by type** — a callee whose type is Solid's `Accessor`, and factory calls resolved by
symbol. This catches cases the AST path can't see:

```ts
// member accessor — only caught with type info
function Row(props: { value: Accessor<number> }) {
  return createMemo(async () => {
    await fetch("/x");
    return props.value(); // ❌ flagged under recommendedTypeChecked
  });
}
```

This is **purely additive** (ADR-0005): it never changes a verdict on code the AST path already handles, and it never reports more loosely — the type must be solid's `Accessor` (originating from `solid-js`/`@solidjs/signals`), so a plain `() => T` or a same-named non-solid `Accessor` is left alone. Both modes have **zero false positives**; type info only reduces false negatives.

## Limitations

The "after an await" check is intentionally **sound over complete** — it never reports correct code, at the cost of missing some genuinely-buggy shapes (false negatives):

- An `await` reached only on one branch of an `if`/`switch`, or only on later iterations of a loop, is not treated as guaranteed, so a read after it is not flagged.
- Reads inside a nested helper closure are not analyzed — the rule can't know when the helper is invoked.
- Only signal/memo **accessors** are tracked. A store proxy read after an await is not covered (`createProjection` returns a store, so its _result_ isn't checked — but its async compute body is).

## Notes

- Accessors aliased through a plain `const` (`const c = count`) are still caught; `untrack(() => count())` is allowed.
- The async **apply** callback of an effect (the second argument) is not checked here — its untracked reads are reported by [`no-untracked-read-in-effect-apply`](./no-untracked-read-in-effect-apply.md).
