# `solid/jsx-no-duplicate-props`

Disallow duplicate JSX props and conflicting child sources.

This rule catches repeated props on the same element, duplicate `class` values, and combinations that compete to define children, such as `children`, JSX children, `innerHTML`, and `textContent` at the same time.

## Bad

```tsx
<div class="a" class="b" />
```

```tsx
<div a="a" {...{ a: "aaaa" }} />
```

```tsx
<div children={<span />}>
  <span />
</div>
```

```tsx
<div innerHTML="<p>Hello</p>" textContent="Hello" />
```

```tsx
<div on:click={handleClick} on:Click={handleAgain} />
```

## Good

```tsx
<div class="a b" />
```

```tsx
<div a="a" {...{ b: "b" }} />
```

```tsx
<div>
  <span />
</div>
```

```tsx
<div children={<span />} />
```

```tsx
<div onClick={handleSyntheticClick} on:click={handleNativeClick} />
```

## Notes

- `prop:name` is treated as the same underlying prop as `name`.
- `on:click` and `on:Click` count as duplicates.
- `onClick` and `on:click` are treated as different APIs and are allowed together.
- With `ignoreCase: true`, plain prop names are also compared case-insensitively.
