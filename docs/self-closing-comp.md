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

- **Why a stylistic rule lives in a correctness plugin:** this is the one deliberate scope
  exception. It survives because it is _semantically inert_ (the report and both autofix
  directions cannot change behavior, so the zero-FP/zero-corrupting-autofix bars are trivially
  met), no formatter in the toolchain performs this normalization, and it was carried forward from
  the original `eslint-plugin-solid` where users expect it. It is held to the same bars as every
  other rule; it just guards style rather than correctness.
- `component` controls Solid/JSX components: `"all"` or `"none"`.
- `html` controls DOM elements: `"all"`, `"void"`, or `"none"`.
- Whitespace-only multiline children are treated as empty and can still be self-closed.
- Non-breaking spaces and explicit space expressions are treated as real children and are not self-closed.
