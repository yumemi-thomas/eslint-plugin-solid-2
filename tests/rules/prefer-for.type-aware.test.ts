import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import rule from "../../src/rules/prefer-for.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tsconfigRootDir = fileURLToPath(new URL("../fixtures", import.meta.url));

// With `typescriptEnabled: true`, `.map` on a non-array receiver (which would autofix to a broken
// `<For each>`) is not reported; an array receiver still is.
const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser as never,
    parserOptions: {
      projectService: { allowDefaultProject: ["*.tsx"] },
      tsconfigRootDir,
    },
  },
});

const options = [{ typescriptEnabled: true }];

ruleTester.run("prefer-for (type-aware)", rule as never, {
  valid: [
    {
      // `obs.map` is not an array's map → no `<For>` suggestion under type info.
      filename: `${tsconfigRootDir}/obs.tsx`,
      options,
      code: `declare const obs: { map(fn: (x: number) => unknown): unknown };
const view = <ul>{obs.map((x) => <li>{x}</li>)}</ul>;
export { view };`,
    },
    {
      // A union that may be a different mappable collection is not proven Array#map.
      filename: `${tsconfigRootDir}/mixed-map.tsx`,
      options,
      code: `type Observable = { map(fn: (x: number) => unknown): unknown };
declare const values: number[] | Observable;
const view = <>{values.map((x) => <span>{x}</span>)}</>;
export { view };`,
    },
  ],
  invalid: [
    {
      filename: `${tsconfigRootDir}/arr.tsx`,
      options,
      code: `declare const arr: number[];
const view = <ul>{arr.map((x) => <li>{x}</li>)}</ul>;
export { view };`,
      errors: [{ messageId: "preferFor" }],
      // The autofix also inserts the `For` import so the rewritten code compiles.
      output: `import { For } from "solid-js";
declare const arr: number[];
const view = <ul><For each={arr}>{(x) => <li>{x}</li>}</For></ul>;
export { view };`,
    },
    {
      // Array#map supplies a third array argument; <For> does not. Keep the useful report but never
      // offer a behavior-changing autofix.
      filename: `${tsconfigRootDir}/arr-third-param.tsx`,
      options,
      code: `declare const arr: number[];
const view = <ul>{arr.map((x, i, all) => <li>{i}: {x}/{all.length}</li>)}</ul>;
export { view };`,
      errors: [{ messageId: "preferFor" }],
      output: null,
    },
    {
      // Function callbacks may observe their own arguments/this semantics.
      filename: `${tsconfigRootDir}/arr-function.tsx`,
      options,
      code: `declare const arr: number[];
const view = <ul>{arr.map(function (x) { return <li>{x}/{arguments.length}</li>; })}</ul>;
export { view };`,
      errors: [{ messageId: "preferFor" }],
      output: null,
    },
  ],
});
