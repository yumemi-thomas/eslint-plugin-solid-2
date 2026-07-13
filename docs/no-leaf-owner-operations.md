# `solid/no-leaf-owner-operations`

Disallow `onCleanup`, child computation/owner creation, and `flush()` directly inside
`createTrackedEffect(...)` and owner-backed `onSettled(...)` callbacks.

A leaf owner cannot own or schedule. Three things are therefore forbidden in its callback body, all facets of the same runtime constraint:

- **`onCleanup`** — return a cleanup function instead.
- **Creating child computations/owners** (`createMemo`, effects, projections, roots, list mappings,
  boundaries, and the function forms of signal/store factories) — move them to the component body
  or another owner. Plain value-form signals and stores do not create a child owner and are allowed
  by the beta.17 runtime.
- **`flush()`** — schedule work outside instead.

## Bad

```ts
onSettled(() => {
  onCleanup(() => console.log("cleanup"));
});
```

```ts
createTrackedEffect(() => {
  const memo = createMemo(() => count() * 2);
});
```

```ts
onSettled(() => {
  flush();
});
```

## Good

```ts
onSettled(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
});
```

```ts
const memo = createMemo(() => count() * 2);
createTrackedEffect(() => {
  console.log(memo());
});
```

```ts
createEffect(
  () => count(),
  () => {
    queueMicrotask(() => flush());
  },
);
```

## Notes

- Only **direct** calls inside the forbidden callback body are checked; nested helper function definitions are allowed.
- Calls are matched by binding (a `solid-js` import, alias, or unresolved global) — a same-named function from another package is not flagged.
- `createContext` is a context factory and is allowed. `createRoot` creates a child owner and is
  rejected by beta.17 beneath a leaf owner.
- `onSettled` is a leaf owner only when called under an owner. Calls from event handlers or another
  leaf owner are scheduled unowned, so their callbacks are not classified as leaf-owner scopes.
- This rule replaces the former `no-cleanup-in-forbidden-scope`, `no-flush-in-forbidden-scope`, and `no-primitives-in-forbidden-scope` rules (see [ADR-0006](./adr/0006-merge-leaf-owner-rules.md)).
