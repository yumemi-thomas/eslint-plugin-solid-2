# eslint-plugin-solid-2

ESLint rules for [Solid 2](https://solidjs.com) — catches reactivity bugs, removed APIs, and React-isms that don't translate to Solid.

## Quick start

Flat config:

```js
// eslint.config.js
import solid from "eslint-plugin-solid-2";

export default [solid.configs["flat/recommended"]];
```

TypeScript projects: use `solid.configs["flat/typescript"]` instead.

Legacy `.eslintrc` config:

```json
{
  "extends": ["plugin:solid-2/recommended"]
}
```

Override individual rules with the standard ESLint syntax:

```js
{
  rules: {
    "solid/no-destructure": "error",
    "solid/prefer-for": "off",
  },
}
```

## With Oxlint (JS plugins)

Oxlint can load this plugin through its [JS plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins) interface. Use the alias form so rules are prefixed `solid/` (the package name `eslint-plugin-solid-2` would otherwise resolve to `solid-2/`).

In `.oxlintrc.json`:

```json
{
  "jsPlugins": [{ "name": "solid", "specifier": "eslint-plugin-solid-2" }],
  "rules": {
    "solid/no-untracked-reactive-read": "error",
    "solid/no-owned-scope-writes": "error",
    "solid/no-react-deps": "error"
  }
}
```

In a Vite+ project, put it under `lint` in `vite.config.ts`:

```ts
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    jsPlugins: [{ name: "solid", specifier: "eslint-plugin-solid-2" }],
    rules: {
      "solid/no-untracked-reactive-read": "error",
    },
  },
});
```

## What it catches

Rules covering Solid 2's runtime warnings:

- `no-owned-scope-writes` — `SIGNAL_WRITE_IN_OWNED_SCOPE`
- `no-untracked-reactive-read` — `STRICT_READ_UNTRACKED`
- `no-async-outside-loading-boundary` — `ASYNC_OUTSIDE_LOADING_BOUNDARY`
- `no-invalid-cleanup-return`, `no-cleanup-in-forbidden-scope`, `no-flush-in-forbidden-scope`, `no-primitives-in-forbidden-scope` — effect-shape mistakes
- `no-signal-in-effect-apply`, `no-store-proxy-in-effect-apply` — apply-callback pitfalls
- `no-react-deps`, `no-destructure` — React patterns that don't track in Solid
- `no-unknown-namespaces` — JSX namespaces removed in Solid 2

Plus general JSX hygiene: `jsx-no-duplicate-props`, `jsx-no-script-url`, `jsx-no-undef`, `jsx-uses-vars`, `no-innerhtml`, `no-array-handlers`, `components-return-once`, `prefer-for`, `prefer-show`, `self-closing-comp`, `style-prop`.

Per-rule docs are in [`docs/`](./docs).

## Installation

Not yet published. Clone and build, then add as a local dependency:

```bash
git clone <repo> eslint-plugin-solid-2
cd eslint-plugin-solid-2
vp install
vp pack
```

In your project:

```bash
pnpm add -D file:../path/to/eslint-plugin-solid-2
```

pnpm symlinks the package, so rebuilds are picked up automatically.
