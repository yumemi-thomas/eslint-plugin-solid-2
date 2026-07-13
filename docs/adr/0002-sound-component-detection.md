# Sound component detection, with opt-in type-aware coverage

**Context.** Several rules (`components-return-once`, `no-owned-scope-writes`,
`no-destructure`) need to know "is this function a Solid component?" The original
`isComponentLike` guessed _returns JSX and isn't lowercase-named_ — not sound: a
JSX-returning helper called imperatively (`const cell = RenderRow(data)`) matched
it and was falsely flagged. An earlier attempt made this two-tier with
_automatic_ type-aware suppression, but that produced **corrective variance** —
the AST-only result was a false positive that type info silently removed, so the
same code was flagged under oxlint but clean under type-aware ESLint. Type-aware
analysis also has a real cost (it forces a TS `Program`) that shouldn't be
incurred silently.

**Decision.** Detect components only by **sound** signals — never the leaky
capitalized-JSX guess — and make any type-checker use **explicit and opt-in**:

- **Default (AST/scope only, no type-checker):** a function is a component iff it
  is annotated `Component`/`VoidComponent`/`ParentComponent`/`FlowComponent`, or
  is used as `<C/>` in the same file. Zero false positives. Runs on oxlint.
- **`typescriptEnabled: true` (per-rule option, off by default):** _additionally_
  treat a function as a component when its symbol is used as a JSX tag anywhere
  in the program (catches exported/cross-file components). Requires ESLint type
  information and is slower; documented as such.

The type-aware path is **purely additive** — it only ever finds _more_ real
components, never flips a verdict on correct code. So there is no corrective
variance: behaviour is consistent and zero-FP in every environment; the option
only buys extra coverage at a cost the user opts into.

## Consequences

- Detection is exposed as a self-indexing `isComponent(node, context)`: it builds the in-file
  `<C/>` usage index once per source (memoized on `SourceCode`) and reads `typescriptEnabled` from
  `context` itself. Because that index is complete on first query, rules call it **inline during
  traversal** — no rule threads a `jsxComponentNames` set or defers detection to `Program:exit`.
  Do not push the index back onto callers.
- The in-file `<C/>` index is keyed by **binding, not name** (`getInFileComponentVariables`): each
  _direct_ identifier tag is resolved to the variable it references, so a local helper whose name
  collides with an imported component is not conflated with it. Host elements (lowercase tags) and
  member-tag roots (`<Foo.Bar/>` renders `Foo.Bar`, not `Foo`) are excluded — a function is detected
  only when used as a bare `<Fn/>`. (An earlier name-string index false-positived on helpers named
  like host elements — `title`, `summary` — or like an imported component.)
- **Tolerated false negative (member tags):** a component rendered _only_ via a compound/namespaced
  tag (`const Tabs = { Panel }; <Tabs.Panel/>`) is not detected by the default tier — excluding
  member-tag roots is what removes the `<Theme.Provider/>` false positive (a config factory named
  `Theme` is not a component). Zero-FP wins over this FN (ADR-0001); `typescriptEnabled` resolves the
  member-tag symbol and still detects it.
- The annotation signal resolves the type's **binding**, not just its name: a
  function counts as a component only when `Component`/`VoidComponent`/… resolves
  to a `solid-js` import (or an unresolved/ambient global), never a same-named
  local `type`/`interface` or an import from another package. (The original
  implementation matched the bare type name, which false-positived on a
  user-defined `Component` type — an FP audit caught it; `typeNameBindsToSolid`
  in `solid-rule-utils.ts` now enforces the binding, mirroring ADR-0003.)
- **Tolerated false negative:** a bare, unannotated component used only in another
  file is not detected by default. Close it by annotating it `Component<P>`,
  using it as `<C/>` in-file, or enabling `typescriptEnabled`. Each rule's tests
  include an explicit valid case documenting this, so the gap is visible.
- Do **not** restore the capitalized-JSX heuristic — it reintroduces the false
  positive and the corrective variance this decision removes.
- `typescript` remains a peer dependency, used only by the opt-in path.
- `no-untracked-reactive-read` stays deleted: sound component detection is
  necessary but not sufficient for it (it also FPs on intentional one-time reads
  like `createSignal(props.x)`).
