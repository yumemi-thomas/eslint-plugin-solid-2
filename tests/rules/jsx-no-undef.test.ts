import rule from "../../src/rules/jsx-no-undef.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("jsx-no-undef", rule as never, {
  valid: [
    `let el = <div />;`,
    `let Component; let el = <Component />;`,
    `let Component, X = <Component />;`,
    {
      code: `let el = <Component />`,
      options: [{ typescriptEnabled: true }],
    },
  ],
  invalid: [
    {
      code: `let el = <Component />;`,
      errors: [{ messageId: "undefined", data: { identifier: "Component" } }],
    },
    {
      code: `
function register() {
  let Component;
}

let el = <Component />;`,
      errors: [{ messageId: "undefined", data: { identifier: "Component" } }],
    },
    {
      code: `let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `import { For } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `let el = <Show when={item}>{item => item.name}</Show>`,
      errors: [{ messageId: "autoImport", data: { imports: "'Show'", source: "solid-js" } }],
      output: `import { Show } from "solid-js";
let el = <Show when={item}>{item => item.name}</Show>`,
    },
    {
      code: `
render(
  <Switch fallback={<div>Not Found</div>}>
    <Match when={state.route === "home"} />
  </Switch>
)`,
      errors: [
        { messageId: "autoImport", data: { imports: "'Switch' and 'Match'", source: "solid-js" } },
      ],
      output: `import { Switch, Match } from "solid-js";

render(
  <Switch fallback={<div>Not Found</div>}>
    <Match when={state.route === "home"} />
  </Switch>
)`,
    },
    {
      code: `
import X from "x";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import { For } from "solid-js";
import X from "x";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
import { Show } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import { Show, For } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
import { For, Switch } from "solid-js";
render(
  <Switch fallback={<div>Not Found</div>}>
    <Match when={state.route === "home"} />
  </Switch>
)`,
      errors: [{ messageId: "autoImport", data: { imports: "'Match'", source: "solid-js" } }],
      output: `
import { For, Switch, Match } from "solid-js";
render(
  <Switch fallback={<div>Not Found</div>}>
    <Match when={state.route === "home"} />
  </Switch>
)`,
    },
    {
      code: `
import X from "x";
import { Show } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import X from "x";
import { Show, For } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
import X from "x";
import Solid from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import X from "x";
import Solid, { For } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
import X from "x";
import "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import X from "x";
import { For } from "solid-js";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
// attached comment
import X from "x";
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import { For } from "solid-js";
// attached comment
import X from "x";
let el = <For each={items}>{item => item.name}</For>`,
    },
    {
      code: `
import X from "x"; // attached comment
let el = <For each={items}>{item => item.name}</For>`,
      errors: [{ messageId: "autoImport", data: { imports: "'For'", source: "solid-js" } }],
      output: `
import { For } from "solid-js";
import X from "x"; // attached comment
let el = <For each={items}>{item => item.name}</For>`,
    },
  ],
});
