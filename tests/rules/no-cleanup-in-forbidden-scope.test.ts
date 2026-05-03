import rule from "../../src/rules/no-cleanup-in-forbidden-scope.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-cleanup-in-forbidden-scope", rule as never, {
  valid: [
    `createEffect(() => count(), (value) => {
      onCleanup(() => console.log(value));
    });`,
    `onSettled(() => {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    });`,
    `onSettled(() => {
      const later = () => {
        onCleanup(() => console.log("cleanup"));
      };
      void later;
    });`,
  ],
  invalid: [
    {
      code: `onSettled(() => {
        onCleanup(() => console.log("cleanup"));
      });`,
      errors: [{ messageId: "noCleanupInForbiddenScope" }],
    },
    {
      code: `createTrackedEffect(() => {
        onCleanup(() => console.log("cleanup"));
      });`,
      errors: [{ messageId: "noCleanupInForbiddenScope" }],
    },
  ],
});
