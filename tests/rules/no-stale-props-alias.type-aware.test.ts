import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import rule from "../../src/rules/no-stale-props-alias.js";

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

const code = `import type { Component } from "solid-js";
import { ReShow } from "./control-flow-reexport";
const Card: Component<{ user: { name: string } | undefined }> = props => (
  <ReShow when={props.user}>{user => {
    const name = user().name;
    return <span>{name}</span>;
  }}</ReShow>
);
export { Card };`;

ruleTester.run("no-stale-props-alias (type-aware control flow)", rule as never, {
  valid: [
    {
      filename: `${tsconfigRootDir}/control-flow-option-off.tsx`,
      code,
    },
    {
      filename: `${tsconfigRootDir}/control-flow-non-solid.tsx`,
      options: [{ typescriptEnabled: true }],
      code: `import type { Component } from "solid-js";
declare const ReShow: (props: { when: boolean; children: () => string }) => unknown;
const Card: Component<{ visible: boolean; name: string }> = props => (
  <ReShow when={props.visible}>{() => props.name}</ReShow>
);`,
    },
  ],
  invalid: [
    {
      filename: `${tsconfigRootDir}/control-flow-reexported.tsx`,
      options: [{ typescriptEnabled: true }],
      code,
      errors: [{ messageId: "staleReactiveRead" }],
    },
  ],
});
