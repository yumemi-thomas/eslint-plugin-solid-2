# `solid/no-primitives-in-forbidden-scope`

Disallow creating reactive primitives inside `createTrackedEffect(...)` and `onSettled(...)`.

Those scopes are leaf owners in Solid 2. Create your signals, memos, stores, and other reactive primitives outside them, then read or write them from inside.

## Bad

```ts
onSettled(() => {
  const [count] = createSignal(0);
});
```

```ts
createTrackedEffect(() => {
  const memo = createMemo(() => count() * 2);
});
```

## Good

```ts
const [count] = createSignal(0);

onSettled(() => {
  console.log(count());
});
```

```ts
const memo = createMemo(() => count() * 2);

createTrackedEffect(() => {
  console.log(memo());
});
```

## Notes

- This rule only checks direct primitive creation inside the forbidden callback.
- Nested helper function definitions are allowed unless they are actually called there and trigger another rule on their own code path.
- `createContext` and `createRoot` are not reactive primitives and are not flagged. The runtime diagnostic targets `createSignal`, `createMemo`, `createEffect`, `createStore`, `createProjection`, `createOptimistic`, `createOptimisticStore`, `createRenderEffect`, and `createTrackedEffect`.
