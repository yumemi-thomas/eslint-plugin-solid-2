# `solid/no-destructure`

Disallow destructuring component props.

In Solid 2, destructuring props performs top-level untracked reads. That breaks reactivity in the same way as assigning `const title = props.title` in a component body.

## Bad

```tsx
function Component({ title }) {
  return <h1>{title}</h1>;
}
```

```tsx
function Component({ title: heading }) {
  return <h1>{heading}</h1>;
}
```

```tsx
function Component({ title = "Untitled" }) {
  return <h1>{title}</h1>;
}
```

```tsx
function Component({ title, ...rest }) {
  return <Card {...rest}>{title}</Card>;
}
```

```tsx
// destructuring the props object in the body is the same untracked read
function Component(props) {
  const { title } = props;
  return <h1>{title}</h1>;
}
```

## Good

```tsx
function Component(props) {
  return <h1>{props.title}</h1>;
}
```

```tsx
function Component(_props) {
  const props = merge({ title: "Untitled" }, _props);
  return <h1>{props.title}</h1>;
}
```

```tsx
function Component(props) {
  const rest = omit(props, "title");
  return <Card {...rest}>{props.title}</Card>;
}
```

```tsx
function Component(props: Props) {
  return <div p1={props.prop1} p2={props.prop2} />;
}
```

## Notes

- Simple destructures autofix directly to `props.foo` reads.
- Helper-based fixes may rewrite to `merge(...)` and `omit(...)`; the fix also adds the
  `solid-js` import for them when it is missing, so the fixed code always compiles.
- If `merge` or `omit` is already used for something else in the file, the rule stays report-only for that case.
- **The autofix changes observable behavior — deliberately.** The flagged code freezes prop values
  at setup (the bug); the rewrite makes every read live. If a value was _intentionally_ frozen,
  wrap it in `untrack(() => props.x)` instead of destructuring — that form is not reported. This is
  a knowing exception to the "safe autofixes cannot change behavior" tier: the tier exists to
  protect _correct_ code from corruption, and code flagged by this rule is incorrect by the
  runtime's own `STRICT_READ_UNTRACKED` contract.
- Arrow-body helper cases like `({ a = 5 }) => <div a={a} />` are reported but not autofixed.
- Destructuring the props object in the body (`const { a } = props`) is also reported (report-only, no autofix). Only destructures of the component's first parameter are flagged — destructuring an arbitrary object is fine.

## Options

### `typescriptEnabled` (default `false`)

A function is recognised as a component by annotation (`Component`/…) or in-file `<C/>` usage by default. Set `typescriptEnabled: true` to also detect components by their cross-file JSX usage via the TypeScript type-checker (slower; requires ESLint type information).

```json
{ "rules": { "solid/no-destructure": ["warn", { "typescriptEnabled": true }] } }
```
