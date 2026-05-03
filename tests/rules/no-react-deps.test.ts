import rule from "../../src/rules/no-react-deps.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-react-deps", rule as never, {
  valid: [
    `const value = createMemo(() => computeExpensiveValue(a(), b()));`,
    `const value = createMemo((prev) => input() + (prev ?? 0), { lazy: true });`,
    `createEffect(() => count(), (value) => console.log(value));`,
    `createRenderEffect(() => count(), (value) => console.log(value));`,
    `createEffect(() => count(), { effect: (value) => console.log(value) });`,
    `createEffect(
      () => count(),
      (value) => console.log(value),
      { defer: true }
    );`,
  ],
  invalid: [
    {
      code: `const value = createMemo(() => computeExpensiveValue(a(), b()), [a(), b()]);`,
      errors: [{ messageId: "noReactDepsMemo" }],
      output: `const value = createMemo(() => computeExpensiveValue(a(), b()));`,
    },
    {
      code: `const value = createMemo(() => computeExpensiveValue(a(), b()), [a, b]);`,
      errors: [{ messageId: "noReactDepsMemo" }],
      output: `const value = createMemo(() => computeExpensiveValue(a(), b()));`,
    },
    {
      code: `const deps = [a, b];
      const value = createMemo(() => computeExpensiveValue(a(), b()), deps);`,
      errors: [{ messageId: "noReactDepsMemo" }],
    },
    {
      code: `const deps = [a, b];
      const memoFn = () => computeExpensiveValue(a(), b());
      const value = createMemo(memoFn, deps);`,
      errors: [{ messageId: "noReactDepsMemo" }],
    },
    {
      code: `import { createMemo as memo } from "solid-js";
      const value = memo(() => computeExpensiveValue(a(), b()), [a, b]);`,
      errors: [{ messageId: "noReactDepsMemo" }],
      output: `import { createMemo as memo } from "solid-js";
      const value = memo(() => computeExpensiveValue(a(), b()));`,
    },
    {
      code: `const memo = createMemo;
      const value = memo(() => computeExpensiveValue(a(), b()), [a, b]);`,
      errors: [{ messageId: "noReactDepsMemo" }],
      output: `const memo = createMemo;
      const value = memo(() => computeExpensiveValue(a(), b()));`,
    },
    // createEffect with a deps array (no autofix — could be confused with apply callback)
    {
      code: `createEffect(() => count(), [count]);`,
      errors: [{ messageId: "noReactDepsEffect" }],
    },
    {
      code: `createRenderEffect(() => count(), [count]);`,
      errors: [{ messageId: "noReactDepsEffect" }],
    },
    {
      code: `import { createEffect as effect } from "solid-js";
      effect(() => count(), [count]);`,
      errors: [{ messageId: "noReactDepsEffect" }],
    },
    {
      code: `const deps = [count];
      createEffect(() => count(), deps);`,
      errors: [{ messageId: "noReactDepsEffect" }],
    },
  ],
});
