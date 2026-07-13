import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import noLeafOwnerOperations from "../../src/rules/no-leaf-owner-operations.js";
import noOwnedScopeWrites from "../../src/rules/no-owned-scope-writes.js";

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

ruleTester.run("no-leaf-owner-operations (type-aware re-exports)", noLeafOwnerOperations as never, {
  valid: [
    {
      filename: `${tsconfigRootDir}/leaf-reexport-option-off.tsx`,
      code: `import { reTrackedEffect, reFlush } from "./solid-reexports";
reTrackedEffect(() => reFlush());`,
    },
  ],
  invalid: [
    {
      filename: `${tsconfigRootDir}/leaf-reexport-flush.tsx`,
      options,
      code: `import { reTrackedEffect, reFlush } from "./solid-reexports";
reTrackedEffect(() => reFlush());`,
      errors: [{ messageId: "noFlush" }],
    },
    {
      filename: `${tsconfigRootDir}/leaf-reexport-cleanup.tsx`,
      options,
      code: `import { reTrackedEffect, reCleanup } from "./solid-reexports";
reTrackedEffect(() => reCleanup(() => {}));`,
      errors: [{ messageId: "noCleanup" }],
    },
  ],
});

ruleTester.run("no-owned-scope-writes (type-aware re-exports)", noOwnedScopeWrites as never, {
  valid: [
    {
      filename: `${tsconfigRootDir}/owned-reexport-option-off.tsx`,
      code: `import { createSignal } from "solid-js";
import { reMemo } from "./solid-reexports";
const [, setValue] = createSignal(0);
reMemo(() => setValue(1));`,
    },
  ],
  invalid: [
    {
      filename: `${tsconfigRootDir}/owned-reexport-memo.tsx`,
      options,
      code: `import { reMemo, reSignal } from "./solid-reexports";
const [, setValue] = reSignal(0);
reMemo(() => setValue(1));`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      filename: `${tsconfigRootDir}/owned-reexport-refresh.tsx`,
      options,
      code: `import { reMemo, reRefresh } from "./solid-reexports";
const value = reMemo(() => 1);
reMemo(() => reRefresh(value));`,
      errors: [{ messageId: "noOwnedScopeRefresh" }],
    },
    {
      filename: `${tsconfigRootDir}/owned-reexport-action.tsx`,
      options,
      code: `import { reAction, reMemo } from "./solid-reexports";
const save = reAction(function* () {});
reMemo(() => save());`,
      errors: [{ messageId: "noActionInOwnedScope" }],
    },
  ],
});
