# `solid/prefer-for`

Prefer Solid's `<For />` component over `Array#map(...)` when rendering JSX lists.

`<For />` matches Solid's list rendering model better than embedding `map(...)` inside JSX. In Solid 2's default `<For />`, the item callback parameter is a raw value (unlike `index`, which is an `Accessor<number>`), so the autofix leaves item reads untouched and only calls the index parameter.

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
  <For each={items}>{(item) => <li>{item.name}</li>}</For>
</ul>
```

```tsx
<ol>
  {props.data.map((item, i) => (
    <li>
      {i}: {item.name}
    </li>
  ))}
</ol>
// autofixable to (index is an accessor, so it is called):
<ol>
  <For each={props.data}>
    {(item, i) => (
      <li>
        {i()}: {item.name}
      </li>
    )}
  </For>
</ol>
```

```tsx
<ol>{props.data.map((value) => value.text)}</ol>
```

## Notes

- The rule requires TypeScript to prove the receiver is an array. Syntax alone cannot distinguish
  Array#map from an observable or another collection's `.map` method without false positives.
- Autofix only applies to arrow callbacks with at most the item and index parameters. Array's third
  callback argument, normal functions (`arguments`/`this`), destructuring, and rest parameters are
  reported without a fixer.
- The rule reports `map(...)` calls that produce JSX inside JSX, including when wrapped in a `{cond && …}` or `{cond ? … : …}` slot (those wrapped forms are reported but not autofixed).
- Destructured parameters, rest parameters, and other complex callback shapes are reported without a fixer.

## Options

### `typescriptEnabled` (default `false`)

Set `typescriptEnabled: true` to enable the rule. It reports only when the receiver is provably an
array and skips `Map`, `Set`, observables, `any`, and `unknown`. This is enabled by
`recommendedTypeChecked`; the AST-only `recommended` config leaves the rule off.

```json
{ "rules": { "solid/prefer-for": ["warn", { "typescriptEnabled": true }] } }
```
