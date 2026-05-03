# `solid/jsx-uses-vars`

Mark JSX component identifiers as used.

This is a support rule for `no-unused-vars`-style checks. It does not report anything itself. Instead, it tells ESLint that variables referenced from JSX are real usages.

## Examples

```tsx
const Button = (props) => <button>{props.children}</button>;

<Button>Save</Button>;
```

```tsx
const Icons = { Close };

<Icons.Close />;
```

## Notes

- The root identifier of a member expression is marked as used, so `<Icons.Close />` marks `Icons` as used.
- Namespaced attribute syntax like `on:click` is ignored by this rule because it is not a variable reference.
- Use this alongside ESLint's unused-variable rules.
