# `solid/no-stale-props-alias`

Disallow top-level aliases of component props.

Solid 2 tracks prop reads when the property is read in JSX or another tracked scope. A top-level
alias reads once during component setup, outside tracking, so the alias can become stale.

## Invalid

```tsx
const Card: Component = (props) => {
  const name = props.name;
  return <h1>{name}</h1>;
};
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

## Notes

- A report requires an _eager read_: a member access rooted at the props object (`props.name`,
  `props[key]`, reads through a stable alias) or a spread of it (`{ ...props }`). A bare `props`
  reference is never a read — passing the object to `merge`/`omit` or another helper keeps
  reactivity intact. A helper that reads eagerly inside (`createForm(props)`) is a tolerated false
  negative: undecidable from the AST, and flagging it would break correct code.
- Calls such as `console.log(props.name)` outside a variable initializer, reads in nested
  functions, and explicit `untrack(...)` calls are not reported.
- Reassignable props aliases are not followed.
- Destructured props are handled by `solid/no-destructure`.
- Known gap (future work): untracked reads in control-flow render-callback bodies
  (`<Show>{(v) => { const x = props.a; … }}</Show>`) have the same staleness problem as component
  bodies but are not yet covered by this rule.
