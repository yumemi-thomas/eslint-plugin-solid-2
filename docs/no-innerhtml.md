# `solid/no-innerhtml`

Disallow unsafe or conflicting `innerHTML` usage.

`innerHTML` should only be used for trusted HTML strings. The rule distinguishes between static HTML, clearly non-HTML strings, dangerous dynamic values, and conflicting child content.

## Bad

```tsx
<div innerHTML={html} />
```

```tsx
<div innerHTML="Hello world!" />
```

```tsx
<div innerHTML="<p>Hello</p>">
  <span>Child</span>
</div>
```

```tsx
<div dangerouslySetInnerHTML={{ __html: markup }} />
```

```tsx
<div innerHTML="<p>Hello</p>">{identifier}</div>
```

## Good

```tsx
<div innerHTML="<p>Hello</p>" />
```

```tsx
<div innerText="Hello world!" />
```

```tsx
<div dangerouslySetInnerHTML={{ __html: markup }} />
// autofixable to:
<div innerHTML={markup} />
```

```tsx
<div innerHTML="<p>Hello</p><p>world!</p>"></div>
```

## Notes

- With the default `allowStatic: true`, static HTML strings are allowed.
- Static non-HTML strings are reported with an `innerText` suggestion.
- Dynamic values are reported as dangerous.
- Whitespace-only children do not count as a conflict.
