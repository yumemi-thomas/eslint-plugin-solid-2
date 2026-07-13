# The target audience runs TypeScript

**Context.** The "No value in a TypeScript codebase" deletion criterion
([ADR-0001](./0001-only-false-positive-free-rules.md)) removes a rule when `tsc`
already flags the same problem and the rule adds no autofix or migration
guidance. Six rules were deleted on that basis: `jsx-no-undef`, `jsx-uses-vars`,
`no-react-deps`, `no-invalid-cleanup-return`, `no-array-handlers`, and
`no-unknown-namespaces`. (Confirmed afresh for `no-invalid-cleanup-return`: tsc
rejects a non-function literal cleanup return under both plausible Solid typings
`void | CleanupFn` and `CleanupFn | undefined` — the void-return-bivariance
exception applies only to a _bare_ `void` target, never a union, so the rule was
genuinely redundant.)

That criterion silently assumes the user runs `tsc`. But the lean `recommended`
config is deliberately AST-only and oxlint-compatible, and AST-only/oxlint is
exactly the toolchain a plain-JavaScript Solid project would use — for which
`tsc` flags nothing and all six deleted rules would regain real, zero-FP value.
The assumption needed to be made explicit and chosen, not left implicit.

**Decision.** The target audience is **TypeScript Solid 2.0 codebases**. A
pure-JavaScript Solid project with no `tsc` in the loop is **out of scope**. The
AST-only nature of `recommended` is about ESLint/oxlint engine compatibility and
speed only — it does **not** imply we serve a JS-only audience, and it does not
re-open the six tsc-subsumed deletions.

## Consequences

- The six tsc-subsumed deletions stand on the stated assumption. Do not resurrect
  them to serve JS users; that slice is explicitly unsupported.
- Solid 2.0 adoption is overwhelmingly TypeScript (the 2.0 reactivity/types story
  assumes it), so this matches the real audience rather than narrowing it.
- If a JS audience ever becomes a goal, that is a deliberate scope expansion that
  reopens this ADR and the six deletions together — not an incremental tweak.
- `typescript` stays a peer dependency (already required by the opt-in type-aware
  paths, see [ADR-0002](./0002-sound-component-detection.md)).
