import rule from "../../src/rules/no-flush-in-forbidden-scope.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-flush-in-forbidden-scope", rule as never, {
  valid: [
    `function handleSubmit() {
      flush();
    }`,
    `createEffect(() => count(), () => {
      flush();
    });`,
    `onSettled(() => {
      const flushLater = () => {
        flush();
      };
      void flushLater;
    });`,
  ],
  invalid: [
    {
      code: `onSettled(() => {
        flush();
      });`,
      errors: [{ messageId: "noFlushInForbiddenScope" }],
    },
    {
      code: `createTrackedEffect(() => {
        flush();
      });`,
      errors: [{ messageId: "noFlushInForbiddenScope" }],
    },
  ],
});
