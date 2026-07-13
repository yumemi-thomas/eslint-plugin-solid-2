# eslint-plugin-solid-2

Sound ESLint rules for [Solid 2](https://github.com/solidjs/solid/tree/next) reactivity and idiomatic control flow.

Solid 2 changes how effects, ownership, async computations, and control-flow callbacks behave. This plugin catches the mistakes that TypeScript cannot express, while deliberately avoiding diagnostics that `tsc` already provides.

> Solid 2 is currently beta. This package tracks `solid-js@2.0.0-beta.17`.

## Install

```sh
pnpm add -D eslint-plugin-solid-2 eslint typescript @typescript-eslint/parser
```

## Configure

Use the base config when your linter runs without TypeScript program information:

```js
// eslint.config.js
import solid from "eslint-plugin-solid-2";

export default [solid.configs.recommended];
```

For a TypeScript project, prefer the type-checked config. It adds cross-file component detection and enables `prefer-for` only when the receiver is proven to be an array:

```js
// eslint.config.js
import solid from "eslint-plugin-solid-2";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ...solid.configs["recommended-type-checked"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
      },
    },
  },
];
```

The `flat/recommended` and `flat/recommended-type-checked` names are aliases for tools that expect that convention.

## Rules

| Rule                                | What it protects                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `components-return-once`            | Reactive conditional and early returns that freeze component structure.                                  |
| `jsx-no-duplicate-props`            | Competing host-element content sources such as `children`, JSX children, `innerHTML`, and `textContent`. |
| `no-destructure`                    | Destructuring component props, which performs untracked reads.                                           |
| `no-leaf-owner-operations`          | Invalid cleanup, flush, and child-owner work inside leaf owners.                                         |
| `no-owned-scope-writes`             | State writes and action calls from component or compute scopes.                                          |
| `no-reactive-read-after-await`      | Accessor reads after an `await` in a reactive computation.                                               |
| `no-stale-props-alias`              | Top-level aliases of reactive prop reads.                                                                |
| `no-untracked-read-in-effect-apply` | Signal and store reads in an effect apply callback.                                                      |
| `prefer-for`                        | Uses `<For>` for reactive array rendering when type information proves `Array#map`.                      |
| `prefer-show`                       | Uses `<Show>` for idiomatic reactive JSX conditionals.                                                   |
| `self-closing-comp`                 | Keeps empty JSX elements consistently self-closing.                                                      |

Every rule has focused documentation in [docs](./docs).

## Design principles

- TypeScript owns type errors. The plugin does not duplicate diagnostics for invalid JSX names, duplicate attributes, accessor/value mismatches, or other type-checkable mistakes.
- Correct code should stay quiet. When a rule cannot prove a problem, it prefers a false negative to a false positive.
- Autofixes must preserve behavior. Ambiguous cases are reported without a fix or left for an explicit editor suggestion.

The reasoning behind these choices is recorded in the [architecture decision records](./docs/adr).

## Development

This repository uses [Vite+](https://viteplus.dev/).

```sh
vp install
vp check
vp test
vp run build
```

## License

[MIT](./LICENSE)
