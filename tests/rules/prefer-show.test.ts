import rule from "../../src/rules/prefer-show.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("prefer-show", rule as never, {
  valid: [
    `function Component(props) {
      return <Show when={props.cond}>Content</Show>;
    }`,
    `function Component(props) {
      return <Show when={props.cond} fallback="Fallback">Content</Show>;
    }`,
    `function Component(props) {
      return <div>{props.cond && "Content"}</div>;
    }`,
    // Value (non-JSX) conditionals must not be flagged or rewritten into <Show>: doing so changed
    // behavior. Only conditionals with a JSX branch are reported now.
    `function Component(props) {
      return <div>{props.ready ? props.primary : props.secondary}</div>;
    }`,
    `function Component(props) {
      return <div>{props.cond && props.value}</div>;
    }`,
  ],
  invalid: [
    {
      code: `
      function Component(props) {
        return <div>{props.cond && <span>Content</span>}</div>;
      }`,
      output: null,
      errors: [
        {
          messageId: "preferShowAnd",
          suggestions: [
            {
              messageId: "convertToShow",
              output: `
      import { Show } from "solid-js";
function Component(props) {
        return <div><Show when={props.cond}><span>Content</span></Show></div>;
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `
      function Component(props) {
        return <>{props.cond && <span>Content</span>}</>;
      }`,
      output: null,
      errors: [
        {
          messageId: "preferShowAnd",
          suggestions: [
            {
              messageId: "convertToShow",
              output: `
      import { Show } from "solid-js";
function Component(props) {
        return <><Show when={props.cond}><span>Content</span></Show></>;
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `
      function Component(props) {
        return (
          <div>
            {props.cond ? (
              <span>Content</span>
            ) : (
              <span>Fallback</span>
            )}
          </div>
        );
      }`,
      errors: [{ messageId: "preferShowTernary" }],
      output: `
      import { Show } from "solid-js";
function Component(props) {
        return (
          <div>
            <Show when={props.cond} fallback={<span>Fallback</span>}><span>Content</span></Show>
          </div>
        );
      }`,
    },
    {
      code: `
      function Component(props) {
        return (
          <For each={props.someList}>
            {(listItem) => listItem().cond && <span>Content</span>}
          </For>
        );
      }`,
      output: null,
      errors: [
        {
          messageId: "preferShowAnd",
          suggestions: [
            {
              messageId: "convertToShow",
              output: `
      import { Show } from "solid-js";
function Component(props) {
        return (
          <For each={props.someList}>
            {(listItem) => <Show when={listItem().cond}><span>Content</span></Show>}
          </For>
        );
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `
      function Component() {
        return <div>{0 && <span>Content</span>}</div>;
      }`,
      output: null,
      errors: [
        {
          messageId: "preferShowAnd",
          suggestions: [
            {
              messageId: "convertToShow",
              output: `
      import { Show } from "solid-js";
function Component() {
        return <div><Show when={0}><span>Content</span></Show></div>;
      }`,
            },
          ],
        },
      ],
    },
    {
      code: `
      function Component(props) {
        return (
          <For each={props.someList}>
            {(listItem) => (listItem().cond ? (
              <span>Content</span>
            ) : (
              <span>Fallback</span>
            ))}
          </For>
        );
      }`,
      errors: [{ messageId: "preferShowTernary" }],
      output: `
      import { Show } from "solid-js";
function Component(props) {
        return (
          <For each={props.someList}>
            {(listItem) => (<Show when={listItem().cond} fallback={<span>Fallback</span>}><span>Content</span></Show>)}
          </For>
        );
      }`,
    },
    {
      // An existing solid-js import of Show is reused — no duplicate import is added.
      code: `import { Show } from "solid-js";
function Component(props) {
  return <div>{props.cond ? <span>A</span> : <span>B</span>}</div>;
}`,
      errors: [{ messageId: "preferShowTernary" }],
      output: `import { Show } from "solid-js";
function Component(props) {
  return <div><Show when={props.cond} fallback={<span>B</span>}><span>A</span></Show></div>;
}`,
    },
    {
      // A colliding local `Show` binding would make the rewrite resolve to the wrong component,
      // so the autofix is skipped and the conditional is report-only.
      code: `const Show = getWidget();
function Component(props) {
  return <div>{props.cond ? <span>A</span> : <span>B</span>}</div>;
}`,
      errors: [{ messageId: "preferShowTernary" }],
      output: null,
    },
    {
      // block-body render callback (not just an expression body)
      code: `let e = <For each={items}>{(item) => { return item.ok ? <A /> : <B />; }}</For>;`,
      errors: [{ messageId: "preferShowTernary" }],
      output: `import { Show } from "solid-js";
let e = <For each={items}>{(item) => { return <Show when={item.ok} fallback={<B />}><A /></Show>; }}</For>;`,
    },
  ],
});
