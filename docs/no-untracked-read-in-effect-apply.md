# `solid/no-untracked-read-in-effect-apply`

Disallow reading reactive state in a `createEffect` / `createRenderEffect` **apply** callback, which runs untracked.

An effect has two phases: **compute** (tracked — reads here record dependencies) and **apply** (untracked — the side effect). Reading reactive state in the apply phase triggers `STRICT_READ_UNTRACKED` in dev and won't re-run the effect. There are two ways to trip this, both reported by this rule:

1. **Calling a signal/memo accessor** directly in the apply callback.
2. **Reading a store proxy** that was passed through the compute return into the apply callback.

The fix for both: read what you need in the **compute** phase and use the passed value (or `untrack()` for signals, `deep()` for whole-store snapshots).

## Bad

```ts
const [count, setCount] = createSignal(0);
createEffect(
  () => count(),
  (value) => {
    console.log(count());
  }, // ❌ accessor called in apply
);
```

```ts
const [store] = createStore({ user: { name: "A" } });
createEffect(
  () => store.user,
  (user) => sendAnalytics(user.name), // ❌ store proxy read in apply
);
```

## Good

```ts
createEffect(
  () => count(),
  (value) => {
    console.log(value);
  }, // ✅ use the passed value
);
```

```ts
createEffect(
  () => ({ name: store.user.name }), // ✅ extract in compute
  (value) => sendAnalytics(value.name),
);
```

```ts
createEffect(
  () => deep(store), // ✅ deep() returns a plain snapshot safe to read in apply
  (snapshot) => saveToLocalStorage(JSON.stringify(snapshot)),
);
```

```ts
createEffect(
  () => count(),
  (value) => {
    // ✅ the handler runs later, on click — untracked reads are sanctioned there,
    // and the runtime's STRICT_READ_UNTRACKED does not fire for it either
    el.addEventListener("click", () => setOpen(!open()));
  },
);
```

## Options

### `typescriptEnabled` (default `false`)

The AST-only path recognises accessors created in the same file. Set `typescriptEnabled: true` to
also detect imported, parameter, and member accessors whose nominal type originates from Solid.
Structurally similar plain functions and readonly objects are not treated as accessors or stores.

```json
{
  "rules": {
    "solid/no-untracked-read-in-effect-apply": ["warn", { "typescriptEnabled": true }]
  }
}
```

## Notes

- Only reads that happen **directly** in the apply callback are reported — the read's nearest
  enclosing function must be the apply callback itself. A read inside a closure created during
  apply (an event handler, a `setInterval` callback) executes later, outside the apply phase, where
  untracked reads are legitimate; flagging those was a false positive on sanctioned code. A closure
  that is _invoked synchronously during apply_ (`arr.forEach(() => count())`) is a tolerated false
  negative — the runtime diagnostic still covers it on executed paths.
- The `EffectBundle` form (`{ effect(value) { ... } }`) is checked the same way as a bare apply callback.
- Accessors aliased through a plain `const` (`const c = count`) are still caught; `untrack(() => count())` is allowed.
- Store proxy reports require proof: a bare store or a member path known from a literal initializer
  to be an object/array. Computed paths and non-literal initializer shapes are left alone because
  they may return primitives.
- This rule replaces the former `no-signal-in-effect-apply` and `no-store-proxy-in-effect-apply` rules (see [ADR-0006](./adr/0006-merge-leaf-owner-rules.md)).
