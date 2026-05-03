# `solid/jsx-no-undef`

Disallow undefined JSX identifiers.

Component names used in JSX must resolve in scope. The rule can also autofix missing built-in Solid control-flow components by importing them from `solid-js` when possible.

## Bad

```tsx
<Component />
```

```tsx
<UI.Button />
```

```tsx
<Show when={ready()} />
```

```tsx
function register() {
  let Component;
}

<Component />;
```

## Good

```tsx
import { Component } from "./Component";

<Component />;
```

```tsx
const UI = { Button };

<UI.Button />;
```

```tsx
import { Show } from "solid-js";

<Show when={ready()} />;
```

```tsx
let Component;
<Component />;
```

## Notes

- Built-in autofix targets are `For`, `Show`, `Switch`, `Match`, `Loading`, `Errored`, `Reveal`, and `Repeat`.
- `allowGlobals: true` lets the rule treat globals as defined.
- `autoImport: false` disables built-in control-flow imports.
- `typescriptEnabled: true` suppresses ordinary undefined-component reports so TypeScript can handle them, but built-in control-flow autofix still applies.
