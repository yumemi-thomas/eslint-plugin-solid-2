# `solid/no-unknown-namespaces`

Disallow removed or unknown JSX namespaces in Solid 2.

Solid 2 still allows namespaces like `on:` and `prop:`, but many Solid 1 namespaces were removed. This rule reports removed namespaces on DOM elements, reports unknown namespaces, and suggests plain props for namespaced attributes on components.

## Bad

```tsx
<div use:tooltip />
```

```tsx
<div attr:title="x" />
```

```tsx
<div bool:checked />
```

```tsx
<div oncapture:click={handleClick} />
```

```tsx
<div class:mt-10={true} />
```

```tsx
<Box use:tooltip={opts} />
```

## Good

```tsx
<div on:click={handleClick} />
```

```tsx
<div prop:scrollTop={0} />
```

```tsx
<div ref={tooltip(opts)} />
```

```tsx
<div title="x" checked />
```

## Notes

- Allowed by default: `on:`, `prop:`, XML namespaces like `xmlns:` and `xlink:`.
- Removed namespaces are reported with Solid 2-specific messages.
- On components, namespaced props are reported because they have no namespaced runtime meaning there; the rule suggests replacing them with plain props.
- `allowedNamespaces` can be used to permit additional custom namespaces.
