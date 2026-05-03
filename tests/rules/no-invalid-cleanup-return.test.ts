import rule from "../../src/rules/no-invalid-cleanup-return.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-invalid-cleanup-return", rule as never, {
  valid: [
    `createEffect(() => count(), (value) => {
      console.log(value);
    });`,
    `createEffect(() => count(), (value) => {
      return () => console.log(value);
    });`,
    `onSettled(() => {
      return cleanup;
    });`,
    `createEffect(() => count(), {
      effect(value) {
        return () => console.log(value);
      },
    });`,
    // Concise-body arrow that returns whatever the callee returns. console.log → undefined,
    // so this is valid; the rule must not flag bare CallExpression returns.
    `createEffect(() => count(), (value) => console.log(value));`,
    `createRenderEffect(() => count(), (value) => doSomething(value));`,
    // AwaitExpression result type is unknown — must not be flagged blindly.
    `onSettled(async () => await loadCleanup());`,
    // MemberExpression — could be a function reference.
    `onSettled(() => obj.cleanup);`,
  ],
  invalid: [
    {
      code: `createEffect(() => count(), (value) => {
        return value + 1;
      });`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
    {
      code: `createRenderEffect(() => count(), (value) => ({ value }));`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
    {
      code: `onSettled(() => 123);`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
    {
      code: `createTrackedEffect(() => {
        return "cleanup";
      });`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
    {
      code: `createEffect(() => count(), (value) => {
        if (value > 1) {
          return { value };
        }
      });`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
    {
      code: `createEffect(() => count(), {
        effect(value) {
          return { value };
        },
      });`,
      errors: [{ messageId: "noInvalidCleanupReturn" }],
    },
  ],
});
