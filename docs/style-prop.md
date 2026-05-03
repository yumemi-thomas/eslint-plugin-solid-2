# `solid/style-prop`

Validate Solid's `style` prop.

This rule checks that style object keys are valid CSS properties, that they use kebab-case, and that numeric values needing units are written as strings. It can also disallow string `style` values unless `allowString: true` is enabled.

## Bad

```tsx
<div style={{ fontSize: "10px" }} />
```

```tsx
<div style={{ "font-size": 10 }} />
```

```tsx
<div style={{ colour: "red" }} />
```

```tsx
<div style="font-size: 10px; color: red;" />
```

## Good

```tsx
<div style={{ "font-size": "10px" }} />
```

```tsx
<div style={{ "font-size": 0 }} />
```

```tsx
<div style={{ color: "red", "background-color": "green" }} />
```

```tsx
<div style={{ fontSize: "10px" }} />
// autofixable to:
<div style={{ "font-size": "10px" }} />
```

```tsx
<div style={{ "--card-gap": gap() }} />
```

```tsx
<div style="color: red;" />
// with { allowString: true }
```

## Notes

- `allowString: true` allows string and template-literal `style` values.
- Known camelCase CSS names like `fontSize` are reported and autofixed to kebab-case string keys.
- Invalid property names are reported without a fixer.
- Numeric zero is allowed without a unit.
