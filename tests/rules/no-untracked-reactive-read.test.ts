import rule from "../../src/rules/no-untracked-reactive-read.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-untracked-reactive-read", rule as never, {
  valid: [
    `function Title(props) {
      return <h1>{props.title}</h1>;
    }`,
    `function Title(props) {
      const t = untrack(() => props.title);
      return <h1>{t}</h1>;
    }`,
    `function Title(props) {
      const t = createMemo(() => props.title);
      return <h1>{t()}</h1>;
    }`,
    `function Counter() {
      const [count] = createSignal(0);
      return <div>{count()}</div>;
    }`,
    `function Counter() {
      const [count] = createSignal(0);
      const onClick = () => console.log(count());
      return <button onClick={onClick}>Click</button>;
    }`,
    `function Component(props) {
      const [state] = createStore({ user: { name: "static" } });
      return <div>{state.user.name}</div>;
    }`,
    `function Component() {
      return <Show when={user()}>{(u) => <span>{u().name}</span>}</Show>;
    }`,
    `function Component(props) {
      return <For each={props.items}>{(item) => <span>{item().name}</span>}</For>;
    }`,
    `import { Show as Visible } from "solid-js";
    function Component() {
      return <Visible when={user()}>{(u) => <span>{u().name}</span>}</Visible>;
    }`,
  ],
  invalid: [
    {
      code: `function Bad(props) {
        const t = props.title;
        return <h1>{t}</h1>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Bad(props) {
        const title = props.title;
        if (Math.random() > 0.5) {
          return <h1>{title}</h1>;
        }
        return <h2>{title}</h2>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Bad() {
        const [count] = createSignal(0);
        const n = count();
        return <div>{n}</div>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Bad(props) {
        const [state] = createStore({ user: { name: props.title } });
        const user = state.user.name;
        return <div>{user}</div>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }, { messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Bad(props) {
        const { title } = props;
        return <h1>{title}</h1>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Component() {
        return <Show when={user()}>{(u) => {
          const name = u().name;
          return <span>{name}</span>;
        }}</Show>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Component(props) {
        return <For each={props.items}>{(item) => {
          const name = item().name;
          return <span>{name}</span>;
        }}</For>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Component(props) {
        return <Match when={props.ready}>{(value) => {
          const data = value().name;
          return <span>{data}</span>;
        }}</Match>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `function Component(props) {
        return <Show when={props.user}>{(u) => {
          const title = props.title;
          return <span>{title} {u().name}</span>;
        }}</Show>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `import { createSignal as signal } from "solid-js";
      function Bad() {
        const [count] = signal(0);
        const n = count();
        return <div>{n}</div>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
    {
      code: `import { Show as Visible } from "solid-js";
      function Component() {
        return <Visible when={user()}>{(u) => {
          const name = u().name;
          return <span>{name}</span>;
        }}</Visible>;
      }`,
      errors: [{ messageId: "noUntrackedReactiveRead" }],
    },
  ],
});
