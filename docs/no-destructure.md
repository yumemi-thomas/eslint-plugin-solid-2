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
- Helper-based fixes may rewrite to `merge(...)` and `omit(...)`, but the rule does not add imports for you.
- If the fix introduces those helpers, add `import { merge, omit } from "solid-js";` at the top of the file yourself.
- If `merge` or `omit` is already used for something else in the file, the rule stays report-only for that case.
- Arrow-body helper cases like `({ a = 5 }) => <div a={a} />` are reported but not autofixed.
