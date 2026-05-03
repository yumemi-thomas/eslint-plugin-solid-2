# `solid/no-cleanup-in-forbidden-scope`

Disallow `onCleanup(...)` inside `createTrackedEffect(...)` and `onSettled(...)`.

In Solid 2, those callbacks return cleanup directly. Calling `onCleanup(...)` inside them is the wrong lifecycle shape.

## Bad

```ts
onSettled(() => {
  onCleanup(() => dispose());
});
```

```ts
createTrackedEffect(() => {
  onCleanup(() => unsubscribe());
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
createEffect(
  () => count(),
  (value) => {
    onCleanup(() => unsubscribe(value));
  },
);
```

```ts
onSettled(() => {
  const later = () => {
    onCleanup(() => console.log("cleanup"));
  };

  void later;
});
```

## Notes

- This rule only applies to the direct callback passed to `createTrackedEffect(...)` or `onSettled(...)`.
- Nested helper function definitions are not flagged just for existing inside those callbacks.
