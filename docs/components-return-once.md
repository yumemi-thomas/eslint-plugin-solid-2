# `solid/components-return-once`

Keep component JSX returns in one stable place.

Solid components run once. If a component returns different JSX trees from separate `return` sites, or returns top-level JSX conditionals directly, and the decision is **reactive**, that control flow is no longer modeled inside Solid's reactive graph — it is evaluated a single time and goes stale. Keep the branching inside JSX with `<Show />`, `<Switch />`, fragments, or nested render helpers.

A return decided by a **static** guard is fine: `if (isServer) return <noscript />;` or `import.meta.env.DEV` can never change after mount, so a one-time decision is exactly right. The rule therefore reports a conditional or early return only when its guard provably performs a reactive read: a `props` member access, a locally-declared signal/memo accessor call, a store read, or a `const` derived from one of those. Guards it cannot prove reactive (a helper call, a context read, an accessor imported from another file) are not reported — a tolerated false negative; the runtime's `STRICT_READ_UNTRACKED` still covers executed paths.

## Bad

```tsx
function Component(props) {
  const [loading] = createSignal(true);
  if (loading()) {
    return <Spinner />;
  }

  return <Content />;
}
```

```tsx
function Component(props) {
  return props.ready ? <Content /> : <Fallback />;
}
```

```tsx
function Component(props) {
  return props.ready && <Content />;
}
```

## Good

```tsx
function Component() {
  return (
    <Show when={loading()} fallback={<Content />}>
      <Spinner />
    </Show>
  );
}
```

```tsx
function Component() {
  return (
    <Show when={ready()} fallback={<Fallback />}>
      <Content />
    </Show>
  );
}
```

```tsx
function Component() {
  const renderBody = () => {
    if (ready()) return <Content />;
    return <Fallback />;
  };

  return <section>{renderBody()}</section>;
}
```

```tsx
// Static guards are allowed — the decision cannot change after the single run.
function Page() {
  if (isServer) return <noscript />;
  return <div />;
}
```

## Notes

- Early component returns are reported (when reactively guarded), but not autofixed.
- Final ternary returns can often be autofixed to `<Show />` or `<Switch />`.
- Final `&&` returns are reported but not autofixed because `0 && <X />` and `<Show when={0}>` are not equivalent.

## Options

### `typescriptEnabled` (default `false`)

By default a function is recognised as a component only when it is annotated `Component`/`VoidComponent`/`ParentComponent`/`FlowComponent` or used as `<C/>` in the same file — so a bare, unannotated component used only in another file is not checked. Set `typescriptEnabled: true` to also detect components by their cross-file JSX usage via the TypeScript type-checker. This requires ESLint type information and is slower.

```json
{ "rules": { "solid/components-return-once": ["warn", { "typescriptEnabled": true }] } }
```
