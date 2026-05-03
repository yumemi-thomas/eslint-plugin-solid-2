import rule from "../../src/rules/no-primitives-in-forbidden-scope.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-primitives-in-forbidden-scope", rule as never, {
  valid: [
    `const [s, setS] = createSignal(0);
    onSettled(() => {
      console.log(s());
    });`,
    `createEffect(() => count(), (value) => {
      const memo = createMemo(() => value * 2);
      console.log(memo());
    });`,
    `onSettled(() => {
      function buildLater() {
        return createSignal(0);
      }
      void buildLater;
    });`,
    // createContext is a context factory, not a reactive primitive — allowed.
    `onSettled(() => {
      const ctx = createContext("light");
      void ctx;
    });`,
    // createRoot creates a new owner, not a reactive primitive — allowed.
    `createTrackedEffect(() => {
      createRoot((dispose) => {
        dispose();
      });
    });`,
  ],
  invalid: [
    {
      code: `onSettled(() => {
        const [s, setS] = createSignal(0);
      });`,
      errors: [{ messageId: "noPrimitivesInForbiddenScope" }],
    },
    {
      code: `createTrackedEffect(() => {
        const memo = createMemo(() => count() * 2);
      });`,
      errors: [{ messageId: "noPrimitivesInForbiddenScope" }],
    },
  ],
});
