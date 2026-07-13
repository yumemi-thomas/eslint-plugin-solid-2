import { fileURLToPath } from "node:url";
import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";
import rule from "../../src/rules/components-return-once.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tsconfigRootDir = fileURLToPath(new URL("../fixtures", import.meta.url));

// Opt-in type-aware tier (`typescriptEnabled: true`): component-hood is resolved against the whole
// program. A JSX-returning HELPER that is only ever called (never used as `<C/>`) is NOT flagged,
// while a function used as `<C/>` is — even a bare, unannotated function declaration. This is the
// additive coverage the option buys over the sound AST default.
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

ruleTester.run("components-return-once (type-aware)", rule as never, {
  valid: [
    {
      // Badge is a helper: it is never used as `<Badge/>` in the program, so it stays unflagged.
      filename: `${tsconfigRootDir}/badge.tsx`,
      options,
      code: `function Badge(status: string) {
  if (status === "none") return null;
  return <span>{status}</span>;
}
const cell = Badge("ok");
export { cell };`,
    },
    {
      // Without the option, even a used-as-JSX bare declaration relies on the in-file signal only;
      // here it is neither annotated nor used as `<Lonely/>`, so the default (no option) is silent.
      filename: `${tsconfigRootDir}/lonely.tsx`,
      code: `function Lonely(props: { show: boolean }) {
  if (!props.show) return null;
  return <div>x</div>;
}
export { Lonely };`,
    },
  ],
  invalid: [
    {
      // Bare unannotated declaration, used as <Panel/> — caught only because typescriptEnabled
      // resolves the program-wide JSX usage.
      filename: `${tsconfigRootDir}/panel.tsx`,
      options,
      code: `function Panel(props: { open: boolean }) {
  if (!props.open) return null;
  return <div>body</div>;
}
const view = <Panel open={true} />;
export { view };`,
      errors: [{ messageId: "noEarlyReturn" }],
    },
  ],
});
