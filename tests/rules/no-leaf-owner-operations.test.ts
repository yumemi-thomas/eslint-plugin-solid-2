import rule from "../../src/rules/no-leaf-owner-operations.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-leaf-owner-operations", rule as never, {
  valid: [
    `createEffect(() => count(), (value) => {
      onCleanup(() => console.log(value));
    });`,
    `function handleClick() {
      onSettled(() => {
        const memo = createMemo(() => value);
        void memo;
      });
    }`,
    // onSettled called from a leaf owner is deliberately scheduled without an owner in beta.17;
    // its callback is not itself a leaf-owner scope.
    `createTrackedEffect(() => {
      onSettled(() => {
        const memo = createMemo(() => value);
        void memo;
      });
    });`,
    `onSettled(() => {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    });`,
    `createTrackedEffect(() => {
      const buildLater = () => createSignal(0);
      void buildLater;
    });`,
    // Value-form signals/stores register graph state but do not create a child computation/owner.
    `createTrackedEffect(() => {
      const [signal] = createSignal(0);
      const [store] = createStore({ value: 0 });
      void signal;
      void store;
    });`,
    `onSettled(() => {
      const ctx = createContext("light");
      void ctx;
    });`,
    `import store from "redux-ish";
    const { createSignal } = store;
    createTrackedEffect(() => { createSignal(); });`,
  ],
  invalid: [
    {
      code: `createTrackedEffect(() => { onCleanup(() => {}); });`,
      errors: [{ messageId: "noCleanup" }],
    },
    {
      code: `createTrackedEffect(() => { flush(); });`,
      errors: [{ messageId: "noFlush" }],
    },
    {
      code: `import * as solid from "solid-js";
      solid.createTrackedEffect(() => { solid.flush(); });`,
      errors: [{ messageId: "noFlush" }],
    },
    {
      code: `import * as solid from "solid-js";
      solid.createTrackedEffect(() => { solid.onCleanup(() => {}); });`,
      errors: [{ messageId: "noCleanup" }],
    },
    {
      code: `createTrackedEffect(() => { createMemo(() => count()); });`,
      errors: [{ messageId: "noPrimitives" }],
    },
    {
      // createRoot creates an owner, and beta.17 rejects that beneath a leaf owner.
      code: `createTrackedEffect(() => { createRoot(() => {}); });`,
      errors: [{ messageId: "noPrimitives" }],
    },
    {
      code: `createTrackedEffect(() => { mapArray(items, render); });`,
      errors: [{ messageId: "noPrimitives" }],
    },
    {
      code: `const App = () => {
        onSettled(() => { createSignal(() => source()); });
        return <div />;
      };
      const view = <App />;`,
      errors: [{ messageId: "noPrimitives" }],
    },
    {
      code: `createRoot(() => {
        onSettled(() => { onCleanup(() => {}); });
      });`,
      errors: [{ messageId: "noCleanup" }],
    },
  ],
});
