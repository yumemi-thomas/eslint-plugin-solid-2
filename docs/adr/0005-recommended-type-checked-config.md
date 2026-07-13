# Expose type-aware correctness rules via a `recommendedTypeChecked` config

**Context.** Per ADR-0002, the highest-value detection (cross-file component
detection, nominal accessor reads, and sound Array#map identification) needs the type-checker,
but type info is currently reachable only through a per-rule `typescriptEnabled`
flag that most users will never discover. Meanwhile every default rule is
AST-only so the ruleset also runs on oxlint (which has no type-checker).

**Decision.** Keep `recommended` exactly as-is — AST-only, zero-FP, oxlint-
portable — and add a second config **`recommendedTypeChecked`** that turns on the
type-aware paths in one line, mirroring typescript-eslint's own
`recommended` / `recommendedTypeChecked` naming that users already know. The
per-rule `typescriptEnabled` option remains the underlying mechanism; the config
is just the discoverable door. The type-aware paths stay **purely additive**
(ADR-0002) — they find more, never flip a verdict on correct code — so there is
no corrective variance between the two configs.

## Consequences

- oxlint users and the speed-conscious stay on `recommended`; the majority who
  run `tsc` + typescript-eslint flip to `recommendedTypeChecked` and get
  cross-file component detection and sound `prefer-for` coverage without hunting
  per-rule flags.
- `prefer-for` is enabled only in `recommendedTypeChecked`: syntax alone cannot
  distinguish Array#map from an unrelated collection method without false positives.
