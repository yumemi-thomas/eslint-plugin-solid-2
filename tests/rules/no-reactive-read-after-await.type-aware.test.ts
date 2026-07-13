import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import rule from "../../src/rules/no-reactive-read-after-await.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tsconfigRootDir = fileURLToPath(new URL("../fixtures", import.meta.url));

// Type-aware mode is purely additive: it must catch accessors the AST path can't resolve (member,
// parameter, imported, namespace-factory) while keeping ZERO false positives — in particular, a
// plain `() => T` that is structurally identical to `Accessor` but not the solid alias must be left
// alone, and with the option off the rule must behave exactly like the AST-only rule. These tests
// import the real `solid-js` types so the `Accessor`/factory origin checks run against reality.
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser as never,
    parserOptions: {
      projectService: {
        allowDefaultProject: ["*.tsx"],
        maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 100,
      },
      tsconfigRootDir,
    },
  },
});

const options = [{ typescriptEnabled: true }];

ruleTester.run("no-reactive-read-after-await (type-aware)", rule as never, {
  valid: [
    // ZERO false positives — the soundness core of the type-aware path.
    // A plain `() => number` prop (NOT a solid Accessor) read after await: structurally identical to
    // an accessor, but reading it loses no reactive dependency, so it must not be flagged.
    {
      filename: `${tsconfigRootDir}/plain-fn-prop.tsx`,
      options,
      code: `import { createMemo } from "solid-js";
function C(props: { data: () => number }) {
  return createMemo(async () => {
    await fetch("/x");
    return props.data();
  });
}
export { C };`,
    },
    // A locally-declared (non-solid) Accessor type is not solid-origin → not flagged.
    {
      filename: `${tsconfigRootDir}/local-accessor.tsx`,
      options,
      code: `import { createMemo } from "solid-js";
type Accessor<T> = () => T;
function C(props: { data: Accessor<number> }) {
  return createMemo(async () => {
    await fetch("/x");
    return props.data();
  });
}
export { C };`,
    },
    // Off by default: the same member-accessor bug is invisible to the AST-only path (no option).
    // This is the user's "keep the AST-only rule" guarantee.
    {
      filename: `${tsconfigRootDir}/member-no-option.tsx`,
      code: `import { createMemo, type Accessor } from "solid-js";
function C(props: { data: Accessor<number> }) {
  return createMemo(async () => {
    await fetch("/x");
    return props.data();
  });
}
export { C };`,
    },
    // A non-solid *decorated* callable (`(() => T) & { id }`) is not a reactive accessor: its
    // intersection contains no solid `Accessor` member, so it must be left alone.
    {
      filename: `${tsconfigRootDir}/decorated-nonsolid.tsx`,
      options,
      code: `import { createMemo } from "solid-js";
type Widget<T> = (() => T) & { id: string };
declare function makeWidget(): Widget<number>;
const w = makeWidget();
createMemo(async () => {
  await fetch("/x");
  return w();
});
export {};`,
    },
    // Member accessor read BEFORE the await is fine, even under type info.
    {
      filename: `${tsconfigRootDir}/member-before.tsx`,
      options,
      code: `import { createMemo, type Accessor } from "solid-js";
function C(props: { data: Accessor<number> }) {
  return createMemo(async () => {
    const v = props.data();
    await fetch("/x");
    return v;
  });
}
export { C };`,
    },
  ],
  invalid: [
    // FALSE-NEGATIVE REDUCTION — each of these the AST-only path cannot see.

    // 1. Member accessor (`props.data()`); the AST path skips non-identifier callees entirely.
    {
      filename: `${tsconfigRootDir}/member.tsx`,
      options,
      code: `import { createMemo, type Accessor } from "solid-js";
function C(props: { data: Accessor<number> }) {
  return createMemo(async () => {
    await fetch("/x");
    return props.data();
  });
}
export { C };`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "props.data" } }],
    },
    // 2. Parameter typed as an accessor — no factory call to bind to in this file.
    {
      filename: `${tsconfigRootDir}/param.tsx`,
      options,
      code: `import { createMemo, type Accessor } from "solid-js";
function make(data: Accessor<number>) {
  return createMemo(async () => {
    await fetch("/x");
    return data();
  });
}
export { make };`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "data" } }],
    },
    // 3. Namespace factory + namespace-derived signal: both callee shapes are member expressions the
    //    AST path can't match (the factory `solid.createMemo` and the getter `count`).
    {
      filename: `${tsconfigRootDir}/namespace.tsx`,
      options,
      code: `import * as solid from "solid-js";
const [count] = solid.createSignal(0);
solid.createMemo(async () => {
  await fetch("/x");
  return count();
});
export {};`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "count" } }],
    },
    // 4. Accessor returned from a helper (inferred type, no annotation at the call site).
    {
      filename: `${tsconfigRootDir}/returned.tsx`,
      options,
      code: `import { createMemo } from "solid-js";
function useCount() {
  return createMemo(() => 1);
}
const count = useCount();
createMemo(async () => {
  await fetch("/x");
  return count();
});
export {};`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "count" } }],
    },
    // 5. Ecosystem accessor: a value produced by a non-core helper (router, solid-primitives, …) but
    //    typed as solid's `Accessor<T>` is still caught — the gate is the TYPE's origin, not the
    //    producing library.
    {
      filename: `${tsconfigRootDir}/ecosystem.tsx`,
      options,
      code: `import { createMemo, type Accessor } from "solid-js";
declare function useViewportWidth(): Accessor<number>;
const width = useViewportWidth();
createMemo(async () => {
  await fetch("/x");
  return width();
});
export {};`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "width" } }],
    },
    // 6. Decorated ecosystem accessor: a router-style `AccessorWithLatest<T> = Accessor<T> & {...}`.
    //    The outer alias is the library's own, but the intersection contains solid's `Accessor`, so
    //    it is recognized by decomposing the type — no config, no library change.
    {
      filename: `${tsconfigRootDir}/decorated-accessor.tsx`,
      options,
      code: `import { createMemo, type Accessor } from "solid-js";
type AccessorWithLatest<T> = Accessor<T> & { latest: T };
declare function createRouteData(): AccessorWithLatest<number>;
const data = createRouteData();
createMemo(async () => {
  await fetch("/x");
  return data();
});
export {};`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "data" } }],
    },
  ],
});
