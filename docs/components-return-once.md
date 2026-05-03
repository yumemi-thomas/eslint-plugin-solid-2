# `solid/components-return-once`

Keep component JSX returns in one stable place.

Solid components run once. If a component returns different JSX trees from separate `return` sites, or returns top-level JSX conditionals directly, that control flow is no longer modeled inside Solid's reactive graph. Keep the branching inside JSX with `<Show />`, `<Switch />`, fragments, or nested render helpers.

## Bad

```tsx
function Component() {
  if (loading()) {
    return <Spinner />;
  }

  return <Content />;
}
```

```tsx
function Component() {
  return ready() ? <Content /> : <Fallback />;
}
```

```tsx
function Component() {
  return ready() && <Content />;
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

## Notes

- Early component returns are reported, but not autofixed.
- Final ternary returns can often be autofixed to `<Show />` or `<Switch />`.
- Final `&&` returns are reported but not autofixed because `0 && <X />` and `<Show when={0}>` are not equivalent.
