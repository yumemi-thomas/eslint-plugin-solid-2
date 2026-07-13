# `solid/prefer-show`

Prefer Solid's `<Show />` component over JSX `&&` and ternary conditionals when rendering content.

`<Show />` makes conditional rendering explicit and aligns with Solid's control-flow components. Ternary cases can often be autofixed. `&&` cases are only reported because JSX and `<Show when={...}>` differ for falsy non-boolean values.

## Bad

```tsx
<div>{cond && <span>Content</span>}</div>
```

```tsx
<div>{cond ? <span>Content</span> : <span>Fallback</span>}</div>
```

```tsx
<For each={items}>{(item) => (item.ready ? <Ready /> : <Pending />)}</For>
```

## Good

```tsx
<div>
  <Show when={cond}>
    <span>Content</span>
  </Show>
</div>
```

```tsx
<div>
  <Show when={cond} fallback={<span>Fallback</span>}>
    <span>Content</span>
  </Show>
</div>
```

```tsx
<For each={items}>
  {(item) => (
    <Show when={item.ready} fallback={<Pending />}>
      <Ready />
    </Show>
  )}
</For>
```

```tsx
<Show when={cond}>Content</Show>
```

## Notes

- Only conditionals with a JSX branch are reported; plain value conditionals like `{a ? b : c}` or `{cond && value}` are left alone (rewriting them into `<Show>` would change behavior).
- Ternary expressions with a JSX branch are autofixable.
- Render callbacks are inspected whether written with a concise body (`(item) => cond ? <A/> : <B/>`) or a block body (`(item) => { return cond ? <A/> : <B/>; }`).
- `&&` expressions with JSX on the right are reported and offer the `<Show>` rewrite as an **editor suggestion**, never an autofix. `cond && <X/>` evaluates to the left operand when it is falsy, and Solid renders falsy-but-renderable values (`0`, `NaN`) as text — which `<Show>` would drop. A blanket `--fix` could therefore change behavior, so the rewrite is left for you to apply per occurrence after checking the condition's type.
- Example: `0 && <X />` renders `0` in JSX, but `<Show when={0}><X /></Show>` renders nothing. (Do **not** "promote" this suggestion to an autofix.)
