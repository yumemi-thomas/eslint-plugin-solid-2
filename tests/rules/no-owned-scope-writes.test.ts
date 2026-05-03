import rule from "../../src/rules/no-owned-scope-writes.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-owned-scope-writes", rule as never, {
  valid: [
    `const [count, setCount] = createSignal(0);
    const doubled = createMemo(() => count() * 2);`,
    `const [count, setCount] = createSignal(0);
    const [other, setOther] = createSignal(0);
    createEffect(() => count(), (value) => {
      setOther(value);
    });`,
    `const [count, setCount] = createSignal(0);
    const inc = () => setCount((c) => c + 1);
    const Component = () => <button onClick={inc}>Increment</button>;`,
    `const [ready, setReady] = createSignal(false);
    onSettled(() => {
      setReady(true);
    });`,
    `const [ref, setRef] = createSignal(null, { ownedWrite: true });
    createMemo(() => setRef(document.body));`,
    `import { createSignal as signal } from "solid-js";
    const [ref, setRef] = signal(null, { ownedWrite: true });
    createMemo(() => setRef(document.body));`,
    `function Component() {
      const [count, setCount] = createSignal(0);
      const handleClick = () => setCount(count() + 1);
      return <button onClick={handleClick}>Increment</button>;
    }`,
    // 1.x single-arg form is already deprecated — no extra error needed here
    `const [count, setCount] = createSignal(0);
    createEffect(() => {
      setCount(count() + 1);
    });`,
  ],
  invalid: [
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(() => setCount(count() + 1));`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(() => {
        setCount(count() + 1);
        return count();
      }, (value) => {
        console.log(value);
      });`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createRenderEffect(() => setCount(count() + 1), (value) => {
        console.log(value);
      });`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `function Component() {
        const [count, setCount] = createSignal(0);
        setCount(1);
        return <div>{count()}</div>;
      }`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `function Component() {
        const [state, setState] = createStore({ count: 0 });
        setState((s) => {
          s.count += 1;
        });
        return <div>{state.count}</div>;
      }`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `function Component() {
        const [count, setCount] = createSignal(0);
        setCount(1);
        return Math.random() > 0.5 ? <div>{count()}</div> : <span>{count()}</span>;
      }`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
  ],
});
