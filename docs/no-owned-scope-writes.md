# `solid/no-owned-scope-writes`

Disallow writing to signals and stores inside component bodies and reactive compute scopes.

This matches Solid 2's `SIGNAL_WRITE_IN_OWNED_SCOPE` behavior. In these places, derive values instead of writing state back into the graph.

## Bad

```ts
createMemo(() => setCount(count() + 1));
```

```ts
createEffect(
  () => {
    setCount(count() + 1);
    return count();
  },
  (value) => console.log(value),
);
```

```tsx
function Component() {
  const [count, setCount] = createSignal(0);
  setCount(1);
  return <div>{count()}</div>;
}
```

```tsx
function Component() {
  const [state, setState] = createStore({ count: 0 });
  setState((s) => {
    s.count += 1;
  });
  return <div>{state.count}</div>;
}
```

## Good

```ts
const doubled = createMemo(() => count() * 2);
```

```ts
createEffect(
  () => count(),
  (value) => {
    setOther(value);
  },
);
```

```tsx
function Component() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount((c) => c + 1)}>Increment</button>;
}
```

```tsx
function Component() {
  let button: HTMLButtonElement | undefined;
  const [node, setNode] = createSignal<HTMLButtonElement | undefined>(undefined, {
    ownedWrite: true,
  });

  createRenderEffect(() => {
    setNode(button);
  });

  return <button ref={button}>{node() ? "Ready" : "Loading"}</button>;
}
```

## Notes

- Component bodies count as owned scopes.
- The compute phase (first argument) of `createEffect`, `createMemo`, and `createRenderEffect` counts as an owned scope. The apply phase (second argument) of `createEffect`/`createRenderEffect` does not.
- The 1.x single-callback form `createEffect(() => { ... })` is already deprecated in Solid 2 and is not flagged by this rule — the deprecation marker on the type is the relevant signal there.
- `ownedWrite: true` is respected for `createSignal`, including aliased imports.
