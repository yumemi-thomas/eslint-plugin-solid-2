# `solid/jsx-no-script-url`

Disallow `javascript:` URLs in JSX attributes.

`javascript:` URLs are a security footgun and usually indicate that the code should be an event handler instead. This rule checks any JSX attribute whose value can be resolved to a static string.

## Bad

```tsx
<a href="javascript:alert('x')" />
```

```tsx
<iframe src={" javascript:doSomething()"} />
```

```tsx
const link = "javascript:alert('hacked!')";

<a href={link} />;
```

## Good

```tsx
<a href="/settings" />
```

```tsx
<a href={`mailto:${email()}`} />
```

```tsx
<button onClick={handleClick} />
```

```tsx
const link = "https://example.com";

<a href={link} />;
```

## Notes

- The rule is static: it only reports values ESLint can resolve to a string.
- It ignores dynamic values that cannot be evaluated at lint time.
- Prefer event handlers over `javascript:` links.
