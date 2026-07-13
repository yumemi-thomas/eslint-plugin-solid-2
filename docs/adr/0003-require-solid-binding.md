# Match Solid APIs by binding, not by bare name

**Context.** The reactive-scope rules (`no-cleanup`/`no-flush`/`no-primitives-in-forbidden-scope`,
`no-signal-in-effect-apply`) detected both the enclosing scope (`createTrackedEffect`, `onSettled`,
`createEffect`) and the forbidden call (`flush`, `onCleanup`, a primitive factory) by **bare name**
(`canonicalNames.has(name)`), with no check that the name actually came from `solid-js`. That
false-positives on correct code that uses a same-named function from elsewhere — e.g. a stream
library's `flush`, a state library's `createStore`, or a locally-defined `onCleanup` — called inside
a genuine Solid scope. `flush`/`createStore`/`onCleanup` are common names, so this was real. (Verified
by running the rules.) `resolveSolidCallee` had the same latent bug via an early bare-name fallback.

**Decision.** Resolve the callee's binding before treating it as a Solid API (the shared resolver
and binding-fact index live in `analysis/solid-bindings.ts`). A name counts as the Solid API only when it
is a `solid-js` import (direct or aliased) **or** an unresolved global (auto-import). A name that
binds to a local declaration or an import from another package is **not** the Solid API.
`resolveSolidCallee` was tightened the same way and also handles namespace members and immutable
`const` alias chains.

## Consequences

- The four rules (plus `no-store-proxy-in-effect-apply`, which uses `resolveSolidCallee`) no longer
  false-positive on same-named non-Solid functions.
- Genuinely-correct unresolved usage (`createTrackedEffect(() => flush())` with no import, relying on
  auto-import/globals) still fires — we assume an unresolved canonical name is the Solid one.
- This relies only on scope analysis (no type-checker), so it still runs under oxlint.
- Rules with a `typescriptEnabled` path additionally use canonical TypeScript symbols to follow
  Solid APIs through re-export chains; this remains additive to direct binding resolution.
- Residual false negatives remain by design (a call indirected through a renamed local variable, or
  reached via a nested helper) — tolerated per [ADR-0001](./0001-only-false-positive-free-rules.md).
- **Resolution is self-contained (no caller-built alias index).** The shared source-level analysis
  resolves direct, namespace, and `const`-aliased `solid-js` imports, so the per-rule alias `Set`s
  and `ImportDeclaration` handlers that earlier fed a `(aliases, canonicalNames)` pair were redundant
  and were removed; `bindsToSolid`/`resolveSolidCallee`/`isSolidApiCallbackArgument` now take only
  `(identifier, context, canonicalNames)`. `resolveSolidCallee` returns the **canonical** name even
  for an aliased import. The dead `collectSolidAliases` / `matchesSolidName` / `isCallbackArgumentOf`
  helpers were deleted. Do not reintroduce a caller-side alias index "for speed" — `trace` is the
  single resolution path. Reactive accessor/action/setter/store facts are indexed once per source
  and reused by all consumers.
- **The bare-canonical-name fallback fires only for a _truly unresolved_ global.** `trace` returns
  the identifier unchanged both for an auto-import global _and_ for a local the tracer can't follow
  (a `let`, a parameter, a destructured `const { onCleanup } = lib`). `resolveSolidCallee` therefore
  re-checks with `findVariable`: a name that binds to any local declaration is the user's own and
  resolves to null; only a name with no binding (or a defs-less global) is treated as the Solid API.
  This closes a class of false positives on locally-named `flush`/`onCleanup`/`createSignal`.
- **All three detection paths are now binding-based, not name-based** (the point of this ADR, now
  applied uniformly): the callee (`resolveSolidCallee`), the component **type annotation**
  (`typeNameBindsToSolid`, see [ADR-0002](./0002-sound-component-detection.md)), and **component
  usage** (`getInFileComponentVariables` resolves each `<C/>` tag to the variable it references and
  skips host elements / member-tag roots, so a local helper whose name merely collides with an
  imported component is never misclassified).
