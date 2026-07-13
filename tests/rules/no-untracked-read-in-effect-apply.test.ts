import rule from "../../src/rules/no-untracked-read-in-effect-apply.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-untracked-read-in-effect-apply", rule as never, {
  valid: [
    // ===== signal accessor =====
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => { console.log(value); },
    );`,
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      () => { console.log("changed"); },
    );`,
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => { console.log(untrack(() => count())); },
    );`,
    `const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    createEffect(
      () => a(),
      (value) => {
        createEffect(
          () => b(),
          (bVal) => { console.log(bVal); },
        );
      },
    );`,
    `const double = createMemo(() => count() * 2);
    createEffect(
      () => double(),
      (value) => { document.title = String(value); },
    );`,
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      { effect(value) { console.log(value); } },
    );`,
    `createEffect(
      () => document.title,
      (value) => { console.log(value); },
    );`,
    // A read inside a closure created during apply runs later (on click), outside the apply phase,
    // where untracked signal reads are sanctioned — the runtime does not warn there either.
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => {
        document.addEventListener("click", () => { console.log(count()); });
      },
    );`,
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => {
        const id = setInterval(() => console.log(count()), 1000);
        return () => clearInterval(id);
      },
    );`,
    // ===== store proxy =====
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
    // RC-9: a compute that returns a primitive leaf (`store.user.name` resolves to a string in the
    // store shape) carries no proxy into apply, so member access on the apply param is fine.
    `const [store] = createStore({ user: { name: "Ada" } });
    createEffect(
      () => store.user.name,
      (name) => console.log(name.length),
    );`,
    `const [store] = createStore({ user: { name: "Ada" } });
    createEffect(
      () => store.user.name,
      (name) => { const { length } = name; console.log(length); },
    );`,
    // A non-literal initializer or computed path may resolve to a primitive. Without proof that the
    // compute phase returned a proxy, the AST-only rule must stay silent.
    `const [store] = createStore(initialState);
    createEffect(
      () => store.user.name,
      (name) => console.log(name.length),
    );`,
    `const [store] = createStore({ first: "Ada" });
    createEffect(
      () => store[key],
      (value) => console.log(value.length),
    );`,
    // A proxy read inside a closure created during apply runs later, outside the apply phase.
    `const [store] = createStore({ user: { name: "A" } });
    createEffect(
      () => store.user,
      (user) => {
        document.addEventListener("click", () => console.log(user.name));
      },
    );`,
  ],
  invalid: [
    // ===== signal accessor =====
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        (value) => { console.log(count()); },
      );`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      // The apply callback and accessor may be declared indirectly or below the effect call.
      code: `const apply = () => { console.log(count()); };
      createEffect(() => 1, apply);
      const [count] = createSignal(0);`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createEffect(
        () => a(),
        (value) => { console.log(b()); },
      );`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      code: `const double = createMemo(() => count() * 2);
      createEffect(
        () => double(),
        (value) => { document.title = String(double()); },
      );`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createRenderEffect(
        () => count(),
        (value) => { console.log(count()); },
      );`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        { effect(value) { console.log(count()); } },
      );`,
      errors: [{ messageId: "signalRead" }],
    },
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createEffect(
        () => [a(), b()],
        ([aVal, bVal]) => { console.log(a(), b()); },
      );`,
      errors: [{ messageId: "signalRead" }, { messageId: "signalRead" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      const c = count;
      createEffect(() => count(), () => { c(); });`,
      errors: [{ messageId: "signalRead" }],
    },
    // ===== store proxy =====
    {
      code: `const [store] = createStore({ user: { name: "A", age: 1 } });
      createEffect(
        () => store.user,
        (user) => sendAnalytics(user.name, user.age),
      );`,
      errors: [{ messageId: "storeProxyRead" }],
    },
    {
      code: `const [store] = createStore({ user: { name: "A" } });
      createRenderEffect(
        () => store,
        (value) => console.log(value.user.name),
      );`,
      errors: [{ messageId: "storeProxyRead" }],
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
      errors: [{ messageId: "storeProxyRead" }],
    },
    {
      code: `const [store] = createStore({ user: { name: "A" } });
      createEffect(
        () => store.user,
        { effect(user) { console.log(user.name); } },
      );`,
      errors: [{ messageId: "storeProxyRead" }],
    },
  ],
});
