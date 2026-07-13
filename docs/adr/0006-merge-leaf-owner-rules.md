# Merge the forbidden-scope rules into one `no-leaf-owner-operations` rule

**Context.** `no-cleanup-in-forbidden-scope`, `no-flush-in-forbidden-scope`, and
`no-primitives-in-forbidden-scope` were three ~95%-identical files: same
leaf-owner detection (`createTrackedEffect`/`onSettled`), same enter/exit stack,
same binding check — differing only in the matched name-set and the message.
All three are facets of **one** runtime constraint: a leaf owner cannot own or
schedule. There is no sensible config that forbids `flush` in a leaf owner but
allows `onCleanup` — they are invalid for the identical reason. (ESLint
traverses each file once and fans out to all rules, so three rules bought no
extra cost to remove — this is about code shape and API surface, not perf.)

**Decision.** Merge the three into a single rule `no-leaf-owner-operations` with
one `messageId` per violation kind (so the distinct remediation messages
survive) and one doc page explaining leaf owners. Acceptable now because the
plugin is pre-adoption (ADR-0001), so the breaking rename of three rule IDs
costs effectively nothing. Apply the same treatment to the parallel pair
`no-signal-in-effect-apply` + `no-store-proxy-in-effect-apply`, merged into
`no-untracked-read-in-effect-apply` (both are "untracked read in the apply
phase" — one concept, one rule, with `signalRead`/`storeProxyRead` messageIds).
The two detection algorithms differ, so they are preserved intact inside the one
rule rather than rewritten; the merge unifies the rule ID, doc, and config entry.

## Consequences

- Three rule IDs disappear from `recommended` and any disable comments — a
  breaking change, hence done before adoption rather than after.
- Do **not** re-split into per-operation rules: the granularity buys nothing
  (the operations are never independently desirable) and reintroduces the
  duplication this removes.
- **Correction (was inaccurate):** an earlier draft of this ADR claimed "the
  shared leaf-owner/scope-stack machinery lives in `solid-rule-utils.ts`." It
  does not. Solid binding resolution is now shared by `analysis/solid-bindings.ts`, while
  computation callback classification is shared by `analysis/computation-roles.ts`. The
  **scope-tracking state itself is per-rule and
  intentionally different**: `no-leaf-owner-operations` keeps a `forbiddenStack`
  (it must know nesting for any descendant call), while
  `no-untracked-read-in-effect-apply` keeps an `applyCallbacks` set of
  pre-registered callbacks (it only queries known apply functions). A shared
  `reactiveScopeTracker` seam was considered (the two rules are two adapters, so
  the seam is real) but deferred: the two query shapes differ enough that a
  unifying interface risks leaking. Revisit only if a third scope-kind appears.
