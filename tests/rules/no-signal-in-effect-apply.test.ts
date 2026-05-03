import rule from "../../src/rules/no-signal-in-effect-apply.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-signal-in-effect-apply", rule as never, {
  valid: [
    // Correct: use the value parameter, not the signal
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => { console.log(value); },
    );`,

    // Correct: signal only in compute, not in apply
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      () => { console.log("changed"); },
    );`,

    // Correct: signal in apply wrapped in untrack
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      (value) => { console.log(untrack(() => count())); },
    );`,

    // Correct: signal inside a nested createEffect compute inside apply
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

    // Correct: createMemo accessor used in compute, value used in apply
    `const double = createMemo(() => count() * 2);
    createEffect(
      () => double(),
      (value) => { document.title = String(value); },
    );`,

    // Correct: EffectBundle form using value
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      { effect(value) { console.log(value); } },
    );`,

    // Correct: plain function, no signals
    `createEffect(
      () => document.title,
      (value) => { console.log(value); },
    );`,
  ],
  invalid: [
    // Basic: signal called directly in apply
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        (value) => { console.log(count()); },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // Signal not in compute at all, accessed in apply
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createEffect(
        () => a(),
        (value) => { console.log(b()); },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // createMemo accessor called directly in apply
    {
      code: `const double = createMemo(() => count() * 2);
      createEffect(
        () => double(),
        (value) => { document.title = String(double()); },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // createRenderEffect form
    {
      code: `const [count, setCount] = createSignal(0);
      createRenderEffect(
        () => count(),
        (value) => { console.log(count()); },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // EffectBundle form
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        { effect(value) { console.log(count()); } },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // Signal inside a nested non-tracked callback inside apply
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        (value) => {
          document.addEventListener("click", () => { console.log(count()); });
        },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }],
    },

    // Multiple signals in apply — each reported
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createEffect(
        () => [a(), b()],
        ([aVal, bVal]) => { console.log(a(), b()); },
      );`,
      errors: [{ messageId: "noSignalInEffectApply" }, { messageId: "noSignalInEffectApply" }],
    },
  ],
});
