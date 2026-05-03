# `solid/no-untracked-reactive-read`

Disallow untracked reactive reads in component bodies and control-flow callback bodies.

This matches Solid 2's `STRICT_READ_UNTRACKED` warning. It catches top-level reads from props, accessors, and stores in components, plus untracked reads inside `Show`, `Match`, and `For` callback bodies.

## Bad

```tsx
function Component(props) {
  const title = props.title;
  return <h1>{title}</h1>;
}
```

```tsx
function Component() {
  const [count] = createSignal(0);
  const value = count();
  return <div>{value}</div>;
}
```

```tsx
function Component(props) {
  if (ready()) {
    const title = props.title;
    return <h1>{title}</h1>;
  }

  return <span>{props.title}</span>;
}
```

```tsx
<Show when={user()}>
  {(u) => {
    const name = u().name;
    return <span>{name}</span>;
  }}
</Show>
```

## Good

```tsx
function Component(props) {
  return <h1>{props.title}</h1>;
}
```

```tsx
function Component() {
  const [count] = createSignal(0);
  return <div>{count()}</div>;
}
```

```tsx
function Component(props) {
  const title = createMemo(() => props.title);
  return <h1>{title()}</h1>;
}
```

```tsx
<Show when={user()}>{(u) => <span>{u().name}</span>}</Show>
```

```tsx
function Component(props) {
  const title = untrack(() => props.title);
  return <h1>{title}</h1>;
}
```

## Notes

- Branch-return components are checked too, not just direct `return <JSX />` bodies.
- Aliased control-flow components are recognized.
- Reads inside `untrack(...)`, JSX expressions, and tracked scopes like `createMemo(...)` are allowed.
