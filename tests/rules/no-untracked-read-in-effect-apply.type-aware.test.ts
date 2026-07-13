import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import rule from "../../src/rules/no-untracked-read-in-effect-apply.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tsconfigRootDir = fileURLToPath(new URL("../fixtures", import.meta.url));
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

ruleTester.run("no-untracked-read-in-effect-apply (type-aware)", rule as never, {
  valid: [
    {
      filename: `${tsconfigRootDir}/effect-apply-plain-function.tsx`,
      options,
      code: `import { createEffect } from "solid-js";
function install(read: () => number) {
  createEffect(() => 1, () => read());
}
export { install };`,
    },
    {
      filename: `${tsconfigRootDir}/effect-apply-structural-store.tsx`,
      options,
      code: `import { createEffect } from "solid-js";
function install(value: Readonly<{ name: string }>) {
  createEffect(() => value, current => current.name);
}
export { install };`,
    },
    {
      filename: `${tsconfigRootDir}/effect-apply-option-off.tsx`,
      code: `import { createEffect, type Accessor } from "solid-js";
function install(read: Accessor<number>) {
  createEffect(() => 1, () => read());
}
export { install };`,
    },
  ],
  invalid: [
    {
      filename: `${tsconfigRootDir}/effect-apply-parameter.tsx`,
      options,
      code: `import { createEffect, type Accessor } from "solid-js";
function install(read: Accessor<number>) {
  createEffect(() => 1, () => read());
}
export { install };`,
      errors: [{ messageId: "signalRead", data: { name: "read" } }],
    },
    {
      filename: `${tsconfigRootDir}/effect-apply-member.tsx`,
      options,
      code: `import { createEffect, type Accessor } from "solid-js";
function install(props: { read: Accessor<number> }) {
  createEffect(() => 1, () => props.read());
}
export { install };`,
      errors: [{ messageId: "signalRead", data: { name: "props.read" } }],
    },
  ],
});
