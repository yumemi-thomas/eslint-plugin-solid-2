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
<For each={items}>{(item) => (item().ready ? <Ready /> : <Pending />)}</For>
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
    <Show when={item().ready} fallback={<Pending />}>
      <Ready />
    </Show>
  )}
</For>
```

```tsx
<Show when={cond}>Content</Show>
```

## Notes

- Ternary expressions with JSX branches are autofixable.
- `&&` expressions with JSX on the right are reported but not autofixed.
- Example: `0 && <X />` renders `0` in JSX, but `<Show when={0}><X /></Show>` renders nothing.
