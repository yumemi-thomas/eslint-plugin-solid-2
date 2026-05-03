# `solid/self-closing-comp`

Prefer self-closing syntax for empty JSX elements when allowed by the rule options.

This is a formatting/layout rule. It reports empty JSX elements that should be written as self-closing, or self-closing elements that should keep explicit closing tags based on the configured `html` and `component` options.

## Bad

```tsx
<div></div>
```

```tsx
<Button></Button>
```

## Good

```tsx
<div />
```

```tsx
<Button />
```

```tsx
<div> </div>
```

## Notes

- `component` controls Solid/JSX components: `"all"` or `"none"`.
- `html` controls DOM elements: `"all"`, `"void"`, or `"none"`.
- Whitespace-only multiline children are treated as empty and can still be self-closed.
- Non-breaking spaces and explicit space expressions are treated as real children and are not self-closed.
