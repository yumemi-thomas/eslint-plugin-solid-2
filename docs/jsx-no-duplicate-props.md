# `solid/jsx-no-duplicate-props`

Disallow competing JSX content sources.

TypeScript already reports repeated JSX attributes, so this rule focuses only on Solid/DOM content
semantics that the type system does not express: `children`, meaningful JSX children, `innerHTML`,
and `textContent` cannot define the same host element at the same time.

## Bad

```tsx
<div children={<span />}>
  <span />
</div>
```

```tsx
<div innerHTML="<p>Hello</p>" textContent="Hello" />
```

## Good

```tsx
<div>
  <span />
</div>
```

```tsx
<div innerHTML={html}>{/* comments and formatting whitespace are not content */}</div>
```

On custom components these names are author-defined props, so the host-element conflict checks do
not apply.
