import rule from "../../src/rules/no-owned-scope-writes.js";
import { typedTsRuleTester as ruleTester } from "../ruleTester.js";

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
    `const save = action(function* () { yield api.save(); });
    const handleClick = () => save();`,
    `const save = action(function* () { yield api.save(); });
    createTrackedEffect(() => save());`,
    `const [ref, setRef] = createSignal(null, { ownedWrite: true });
    createMemo(() => setRef(document.body));`,
    `import { createSignal as signal } from "solid-js";
    const [ref, setRef] = signal(null, { ownedWrite: true });
    createMemo(() => setRef(document.body));`,
    `const Component: Component = () => {
      const [count, setCount] = createSignal(0);
      const handleClick = () => setCount(count() + 1);
      return <button onClick={handleClick}>Increment</button>;
    }`,
    // 1.x single-arg form is already deprecated — no extra error needed here
    `const [count, setCount] = createSignal(0);
    createEffect(() => {
      setCount(count() + 1);
    });`,
    // Sound default: a bare, unannotated component used only in another file isn't detected,
    // so a write in its body isn't flagged — the tolerated false negative.
    `function Standalone() {
      const [count, setCount] = createSignal(0);
      setCount(1);
      return <div>{count()}</div>;
    }`,
    // RC-2: setter factories are matched by binding, not bare name (ADR-0003). A local `createSignal`
    // and a non-Solid `createStore` (e.g. from "redux") are not Solid setters.
    `function createSignal(v) { let x = v; return [() => x, (n) => { x = n; }]; }
    const Counter: Component = () => {
      const [count, setCount] = createSignal(0);
      setCount(1);
      return <div>{count()}</div>;
    };`,
    `import { createStore } from "redux";
    const Store: Component = () => {
      const [state, setState] = createStore(reducer);
      setState({ type: "INC" });
      return <div>{state.count}</div>;
    };`,
    // RC-2: a local `createMemo` is not Solid's compute scope.
    `function createMemo(fn) { return fn(); }
    function createSignal(v) { return [() => v, (n) => {}]; }
    const [v, setV] = createSignal(0);
    createMemo(() => setV(1));`,
    // RC-2: `ownedWrite: true` exempts createOptimistic, not only createSignal.
    `const [val, setVal] = createOptimistic(0, { ownedWrite: true });
    createMemo(() => setVal(1));`,
    // Cluster B: component detection is by binding, not name. A nested plain helper whose name
    // collides with an imported, rendered component resolves to a different binding, so it is not an
    // owned scope and its setter write is allowed.
    `import { Badge } from "./ui";
    function makeView() {
      const [n, setN] = createSignal(0);
      function Badge(value) { setN(value); return value * 2; }
      return Badge(3);
    }
    const App = () => <Badge label="x" />;`,
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
      // Real function declaration, detected as a component by its in-file `<Counter/>` usage.
      code: `function Counter() {
        const [count, setCount] = createSignal(0);
        setCount(1);
        return <div>{count()}</div>;
      }
      const view = <Counter />;`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `const Component: Component = () => {
        const [state, setState] = createStore({ count: 0 });
        setState((s) => {
          s.count += 1;
        });
        return <div>{state.count}</div>;
      }`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
    {
      code: `const save = action(function* () { yield api.save(); });
      const App: Component = () => {
        save();
        return <button>Save</button>;
      };`,
      errors: [{ messageId: "noActionInOwnedScope" }],
    },
    {
      code: `const save = action(function* () { yield api.save(); });
      createMemo(() => save());`,
      errors: [{ messageId: "noActionInOwnedScope" }],
    },
    {
      code: `const save = action(function* () { yield api.save(); });
      const persist = save;
      createMemo(() => persist());`,
      errors: [{ messageId: "noActionInOwnedScope" }],
    },
    {
      code: `createMemo(() => action(function* () { yield api.save(); })());`,
      errors: [{ messageId: "noActionInOwnedScope" }],
    },
    {
      code: `const Component: Component = () => {
        const [count, setCount] = createSignal(0);
        setCount(1);
        return Math.random() > 0.5 ? <div>{count()}</div> : <span>{count()}</span>;
      }`,
      errors: [{ messageId: "noOwnedScopeWrite" }],
    },
  ],
});
