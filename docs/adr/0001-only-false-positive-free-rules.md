# Ship only false-positive-free rules; lean on tsc and runtime diagnostics

**Context.** This is a brand-new Solid 2 plugin with no track record of bug
reports, so we judge rules by _design-level_ false-positive risk, not by filed
issues. Solid 2 also ships dev-mode runtime diagnostics (`STRICT_READ_UNTRACKED`,
`SIGNAL_WRITE_IN_OWNED_SCOPE`, cleanup/flush/forbidden-scope errors, …) and the
plugin targets TypeScript codebases where `tsc` is always running.

**Decision.** A rule survives only if it has **zero false positives** (it may
have false negatives — silently missing bad code is acceptable; lying about good
code is not). We act on a rule's false positives by _cause_:

- **Fix** it when the FP comes from a fixable implementation flaw (a crude
  heuristic, a lagging allowlist, an unsafe autofix) _and_ it guards real value
  that neither `tsc` nor the runtime covers.
- **Delete** it (rule + tests + docs + config entry) when the FP is _fundamental_
  (asks a statically undecidable question) or when `tsc` already flags the same
  code in a TS codebase. "Disable in recommended" is not used.

The plugin is **TypeScript-only** (we assume `tsc` runs) and every rule works
from the AST/scope alone by default, so the default ruleset runs on **both oxlint
and ESLint** (oxlint's plugin API has no type-checker). Type-aware analysis,
where it helps, is **explicit and opt-in** via a per-rule `typescriptEnabled`
option (off by default, documented as slower) and is **purely additive** — it
finds more, never flips a verdict on correct code. See
[ADR-0002](./0002-sound-component-detection.md) (component detection) and
`prefer-for` (array-receiver check) for the rules that offer it.

There is no exception for security-review heuristics. `no-innerhtml` and
`jsx-no-script-url` were removed because sanitized HTML and author-defined URL-like
props are valid code that static analysis cannot prove safe or unsafe.

## Considered options

- _Disable FP-prone rules in `recommended` but keep them shippable_ — rejected:
  the default experience is where false positives hurt adoption, and we prefer a
  small, trustworthy surface to a large, opt-out one.
- _Keep all rules and accept some FPs_ — rejected: a linter that flags correct
  code trains users to disable it.

## Consequences

- Deleted (fundamental FP): the original heuristic `no-untracked-reactive-read`,
  `no-async-outside-loading-boundary`, `no-innerhtml`, `jsx-no-script-url`.
- Deleted (tsc-subsumed): `jsx-no-undef`, `jsx-uses-vars`, `no-react-deps`,
  `no-invalid-cleanup-return`, `no-array-handlers` (the `[handler, data]` tuple
  is valid Solid 2 and `tsc` type-checks handlers), `no-unknown-namespaces`,
  `accessor-as-prop-value`, `no-dynamic-keyed`, and duplicate JSX-attribute detection.
- Verified empirically against Solid 2 `beta.17` types (tsgo): deletions fire on
  correct code; survivors don't. `no-unknown-namespaces` is tsc-subsumed —
  Solid 2's JSX types have no general namespace index signature (`prop:` needs
  `ExplicitProperties` augmentation, the `class:${string}` index is commented
  out, there is no `Directives`/`on:` mechanism), so `tsc` rejects every
  removed/unknown/style/component-namespaced attribute the rule flags. The DOM
  RFC (dom.md) also removed the `on:` namespace, which the rule still lists as
  allowed — so it is stale as well as redundant.
- A narrower strict-read analysis now lives behind `no-stale-props-alias`: it reports only reads
  proven from bindings or nominal Solid accessor types, and recognizes JSX, nested closures,
  reactive callbacks, and `untrack` as safe execution contexts. It does not restore the deleted
  heuristic's guesses about arbitrary helper calls.
