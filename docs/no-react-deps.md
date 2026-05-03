# `solid/no-react-deps`

Disallow React-style dependency arrays on `createMemo(...)`, `createEffect(...)`, and `createRenderEffect(...)`.

Solid 2 tracks dependencies from the compute function directly. Passing a dependency array is a React pattern, not a Solid one. In `createEffect` / `createRenderEffect` the second argument is the apply callback (or an `EffectBundle` `{ effect, error }` object), so an array there is also wrong.

## Bad

```ts
createMemo(() => compute(a(), b()), [a(), b()]);
```

```ts
const deps = [a, b];
createMemo(() => compute(a(), b()), deps);
```

```ts
createEffect(() => count(), [count]);
```

```ts
createRenderEffect(() => count(), [count]);
```

## Good

```ts
createMemo(() => compute(a(), b()));
```

```ts
createMemo((prev = 0) => input() + prev, { lazy: true });
```

```ts
// Split form: compute tracks deps; apply runs the side effect.
createEffect(
  () => count(),
  (value) => console.log(value),
);
```

```ts
// EffectBundle form for structured error handling.
createEffect(() => count(), {
  effect: (value) => console.log(value),
  error: (err) => console.error(err),
});
```

## Notes

- For `createMemo`, the rule auto-removes the trailing array literal. For `createEffect` / `createRenderEffect`, no autofix is offered: removing the array would leave the deprecated 1.x single-argument form, and the right move depends on whether the user meant to pass an apply callback.
- Aliased imports and simple rebinding (`const memo = createMemo`) are recognised.
