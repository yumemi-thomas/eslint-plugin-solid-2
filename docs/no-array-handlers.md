# `solid/no-array-handlers`

Disallow array event handlers on native elements.

Array-style handler tuples are easy to mis-type and obscure what parameters the handler actually receives. Prefer plain handler functions or explicit closures.

## Bad

```tsx
<button onClick={[save, id()]} />
```

```tsx
const clickHandler = [save, id()];

<button onClick={clickHandler} />;
```

```tsx
<div on:click={[select, item()]} />
```

```tsx
const handler = [save, id()];

<button onclick={handler} />;
```

## Good

```tsx
<button onClick={() => save(id())} />
```

```tsx
<div on:click={(event) => select(item(), event)} />
```

```tsx
function Component(props) {
  return <Button onClick={props.onClick} />;
}
```

```tsx
let handler = [save, id()];
handler = () => save(id());

<button onclick={handler} />;
```

## Notes

- The rule only checks native elements, not component props.
- It follows direct `const` aliases of array handlers.
- It intentionally stays conservative around mutable rebinding like `let handler = ...; handler = ...;`.
