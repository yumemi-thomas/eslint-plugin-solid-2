# A Solid 2.0 correctness guard, not a migration tool; refined deletion criterion and fix tiers

**Context.** It was tempting to give `@thomaflette/eslint-plugin-solid-2` a second mandate:
help people port 1.x→2.0 with rules that flag renamed/moved/removed APIs
(`solid-js/store → solid-js`, `createResource`, `Index`, `classList`, …). We
considered a separate `migration` config of such codemod rules. On reflection we
rejected it: the plugin's job is to **stop people writing incorrect Solid 2.0
code**, not to narrate what changed since 1.x. "This import moved" / "this API
was renamed" is historical nagging, and `tsc` already errors when a removed
symbol doesn't exist. A migration codemod is a separate, one-time tool, not a
linter's standing job.

Two refinements surfaced while reasoning this through and _do_ survive, because
they govern the correctness rules we keep.

**Decision.**

1. **No migration config.** The plugin only detects code that is _wrong in 2.0_
   — regardless of whether the author is migrating or writing fresh. It never
   reports that an API moved or was renamed.

2. **Deletion criterion.** A rule is deleted when `tsc` already reports the
   same problem. An autofix does not justify duplicate diagnostics, especially
   when the fix can fail for unions or otherwise change valid code.

3. **Three fix tiers** — zero-FP extends to "zero-corrupting-autofix":
   - **Safe autofix** (`meta.fixable`, applied by `--fix`) — only for rewrites
     that cannot change behavior (for example ternary→`<Show>`).
   - **Suggestion** (`meta.hasSuggestions`) — a concrete rewrite that _might_
     change behavior; offered one-click in the editor, reviewed per occurrence,
     never run by `--fix`. Home for `&&`→`<Show>`.
   - **Report-only** — when no single mechanical rewrite exists.

**Correctness rules added/affirmed under this scope:**

- `prefer-for` remains essential idiomatic-Solid guidance, but is enabled only
  with type information so Array#map is proven before a report.
- `prefer-show` `&&` case: report-only or suggestion, never a safe autofix —
  `cond && <X/>` renders falsy-but-renderable values (`0`, `NaN`) that
  `<Show>` would drop, so a mechanical rewrite changes behavior.

## Consequences

- `recommended` keeps its trust property: a small, zero-FP correctness surface.
- Porting help is explicitly out of scope — point migrators at a codemod, not
  this plugin.
- See [ADR-0005](./0005-recommended-type-checked-config.md) for how the
  type-aware correctness rules are exposed.
