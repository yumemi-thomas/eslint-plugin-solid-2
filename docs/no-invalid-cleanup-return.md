# `solid/no-invalid-cleanup-return`

Disallow obviously invalid cleanup return values from Solid 2 effect-style callbacks.

Effect apply callbacks, object-form `effect(...)` handlers, `createTrackedEffect`, and `onSettled` should return either a cleanup function or `undefined`.

## Bad

```ts
createEffect(
  () => count(),
  (value) => {
    return value + 1;
  },
);
```

```ts
createRenderEffect(
  () => count(),
  (value) => ({ value }),
);
```

```ts
onSettled(() => 123);
```

```ts
createTrackedEffect(() => {
  return "cleanup";
});
```

```ts
createEffect(() => count(), {
  effect(value) {
    if (value > 1) {
      return { value };
    }
  },
});
```

## Good

```ts
createEffect(
  () => count(),
  (value) => {
    return () => console.log(value);
  },
);
```

```ts
onSettled(() => {
  return cleanup;
});
```

```ts
createEffect(() => count(), {
  effect(value) {
    return () => console.log(value);
  },
});
```

## Notes

- The rule is intentionally conservative: it only reports return values that are clearly wrong.
- Plain identifiers are allowed because the rule cannot know statically whether they reference a cleanup function.
