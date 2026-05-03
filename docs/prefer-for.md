# `solid/prefer-for`

Prefer Solid's `<For />` component over `Array#map(...)` when rendering JSX lists.

`<For />` matches Solid's list rendering model better than embedding `map(...)` inside JSX. In Solid 2, callback parameters inside `<For />` are accessors, so the autofix rewrites simple safe cases to accessor reads like `item()`.

## Bad

```tsx
<ul>
  {items.map((item) => (
    <li>{item.name}</li>
  ))}
</ul>
```

```tsx
<For each={groups}>{(group) => group.items.map((item) => <Row item={item} />)}</For>
```

```tsx
<ol>
  {props.data.map(({ text }) => (
    <li>{text}</li>
  ))}
</ol>
```

## Good

```tsx
<ul>
  <For each={items}>{(item) => <li>{item().name}</li>}</For>
</ul>
```

```tsx
<For each={groups}>
  {(group) => <For each={group().items}>{(item) => <Row item={item()} />}</For>}
</For>
```

```tsx
<ol>{props.data.map((value) => value.text)}</ol>
```

## Notes

- Autofix only applies to simple cases where the callback shape is safe to rewrite.
- The rule only reports `map(...)` calls that produce JSX inside JSX.
- Destructured parameters, rest parameters, and other complex callback shapes are reported without a fixer.
