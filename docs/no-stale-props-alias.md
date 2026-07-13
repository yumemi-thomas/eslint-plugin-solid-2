# `solid/no-stale-props-alias`

Disallow provable untracked reactive reads in component bodies and Solid control-flow function
children. This includes stale props aliases, direct props reads, local signal/memo accessor calls,
store reads, and accessor parameters supplied by control flow.

Solid 2 tracks prop reads when the property is read in JSX or another tracked scope. A top-level
alias reads once during component setup, outside tracking, so the alias can become stale.

The same execution rule applies to direct reads such as `console.log(props.name)` and to the
structure-building bodies of `For`, `Show`, and `Match` function children. JSX expressions,
reactive computations, nested event/helper closures, and explicit `untrack` calls are excluded.

## Invalid

```tsx
const Card: Component = (props) => {
  const name = props.name;
  return <h1>{name}</h1>;
};
```

```tsx
const Counter: Component = () => {
  const [count] = createSignal(0);
  console.log(count()); // direct component-body accessor read
  return <span>{count()}</span>;
};
```

```tsx
<Show when={user()}>
  {(user) => {
    const name = user().name; // function-child accessor read outside JSX tracking
    return <span>{name}</span>;
  }}
</Show>
```

```tsx
const Card: Component = (props) => {
  const userName = props.user.name;
  return <h1>{userName}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const name = props.name;
  validate(name);
  return <h1>{props.name}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const name = props.name ?? "Anonymous";
  return <h1>{name}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const label = formatName(props.name);
  return <h1>{label}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const alias = props;
  const name = alias.name; // the read through the alias is reported, not the alias itself
  return <h1>{name}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const copy = { ...props }; // spreading reads every property eagerly
  return <h1>{copy.name}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  let name;
  name = props.name;
  return <h1>{name}</h1>;
};
```

## Valid

```tsx
const Card: Component = (props) => {
  return <h1>{props.name}</h1>;
};
```

```tsx
const Card: Component = (props) => {
  const name = untrack(() => props.name);
  return <h1>{name}</h1>;
};
```

```tsx
// The canonical defaults / rest patterns: merge and omit return reactive proxies, so passing the
// props object to them is a passthrough, not a read. Their results are tracked as props-like, so
// a later top-level read from them is still reported.
const Card: Component = (_props) => {
  const props = merge({ size: "md" }, _props);
  const rest = omit(props, "class");
  return <div {...rest}>{props.size}</div>;
};
```

```tsx
// A whole-object alias performs no read; property reads through it in JSX stay reactive.
const Card: Component = (props) => {
  const alias = props;
  return <h1>{alias.name}</h1>;
};
```

## Options

### `typescriptEnabled` (default `false`)

Component bodies are recognised by annotation (`Component`/…) or in-file `<C/>` usage by default.
Set `typescriptEnabled: true` to also detect components by their cross-file JSX usage via the
TypeScript type-checker, recognize nominal Solid accessors, and follow re-exported Solid
control-flow components (slower; requires ESLint type information).

```json
{ "rules": { "solid/no-stale-props-alias": ["warn", { "typescriptEnabled": true }] } }
```

## Notes

- A props report requires an _eager read_: a member access rooted at the props object
  (`props.name`, `props[key]`, reads through a stable alias) or a spread of it (`{ ...props }`). A
  bare `props` reference is never a read — passing the object to `merge`/`omit` or another helper
  keeps reactivity intact. A helper that reads eagerly inside (`createForm(props)`) is a tolerated
  false negative because its behavior is undecidable from the call site.
- Direct reads in nested functions and explicit `untrack(...)` calls are not reported.
- Reassignable props aliases are not followed.
- Destructured props are handled by `solid/no-destructure`.
- Function children of binding-proven Solid `For`, `Repeat`, `Show`, and `Match` elements are also
  checked, including `children={fn}`, immutable function aliases, namespace imports, and nested
  Solid control flow. JSX reads and explicit `untrack(...)` reads inside those callbacks remain
  valid because they execute in tracked contexts.
- Callback parameters follow Solid 2's mode-specific semantics: default `For` indexes,
  `keyed={false}` items, custom-key `For` items/indexes, and non-keyed `Show`/`Match` values are
  accessors. Default `For` items, `Repeat` indexes, and keyed `Show`/`Match` values are raw.
- Type-aware mode additionally recognizes canonically typed Solid control-flow components that
  arrive through re-export chains.
