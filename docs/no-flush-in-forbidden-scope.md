# `solid/no-flush-in-forbidden-scope`

Disallow `flush()` inside `createTrackedEffect(...)` and `onSettled(...)`.

Those scopes are not the right place to force synchronous application. If you need `flush()`, do it from an event handler, test, or other outer imperative code.

## Bad

```ts
onSettled(() => {
  flush();
});
```

```ts
createTrackedEffect(() => {
  flush();
});
```

## Good

```ts
function handleSubmit() {
  flush();
}
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

- This rule checks only direct calls to `flush()` inside the forbidden callback body.
- Nested helper function definitions inside those callbacks are allowed.
