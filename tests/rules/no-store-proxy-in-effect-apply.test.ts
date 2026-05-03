import rule from "../../src/rules/no-store-proxy-in-effect-apply.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-store-proxy-in-effect-apply", rule as never, {
  valid: [
    `const [store] = createStore({ user: { name: "A", age: 1 } });
    createEffect(
      () => ({ name: store.user.name, age: store.user.age }),
      (value) => sendAnalytics(value.name, value.age),
    );`,
    `const [store] = createStore({ user: { name: "A" } });
    createEffect(
      () => deep(store),
      (snapshot) => saveToLocalStorage(JSON.stringify(snapshot)),
    );`,
    `const [store] = createStore({ user: { name: "A" } });
    createEffect(
      () => store.user,
      (user) => console.log(user),
    );`,
    `const [store] = createStore({ user: { name: "A", age: 1 } });
    createEffect(
      () => ({ name: store.user.name, age: store.user.age }),
      { effect(value) { sendAnalytics(value.name, value.age); } },
    );`,
  ],
  invalid: [
    {
      code: `const [store] = createStore({ user: { name: "A", age: 1 } });
      createEffect(
        () => store.user,
        (user) => sendAnalytics(user.name, user.age),
      );`,
      errors: [{ messageId: "noStoreProxyInEffectApply" }],
    },
    {
      code: `const [store] = createStore({ user: { name: "A" } });
      createRenderEffect(
        () => store,
        (value) => console.log(value.user.name),
      );`,
      errors: [{ messageId: "noStoreProxyInEffectApply" }],
    },
    {
      code: `const [store] = createStore({ user: { name: "A" } });
      createEffect(
        () => store.user,
        (user) => {
          const { name } = user;
          console.log(name);
        },
      );`,
      errors: [{ messageId: "noStoreProxyInEffectApply" }],
    },
    {
      code: `const [store] = createStore({ user: { name: "A" } });
      createEffect(
        () => store.user,
        { effect(user) { console.log(user.name); } },
      );`,
      errors: [{ messageId: "noStoreProxyInEffectApply" }],
    },
  ],
});
