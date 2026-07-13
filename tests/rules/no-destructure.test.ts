import rule from "../../src/rules/no-destructure.js";
import { typedTsRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-destructure", rule as never, {
  valid: [
    // Sound default: a bare, unannotated component used only in another file isn't detected, so
    // destructuring its props isn't flagged — the tolerated false negative.
    `function Standalone({ title }) {
      return <h1>{title}</h1>;
    }`,
    `let Component: Component =props => <div />`,
    `let Component: Component =(props) => <div />`,
    `let Component: Component =(props) => { return <div />; }`,
    `let Component: Component =(props) => (<div />)`,
    `let Component: Component =props => null`,
    `let Component: Component =(props) => <div a={props.a} />`,
    `let Component: Component =(props) => {
      const rest = omit(props, "a");
      return <div a={props.a} b={rest.b} />;
    }`,
    `let Component: Component =props => {
      const { a } = someFunction();
      return <div a={a} />
    }`,
    `let NotAComponent = ({ a }, more, params) => <div a={a} />`,
    `let Component: Component =props => {
      let inner = ({ a, ...rest }) => a;
      let a = inner({ a: 5 });
      return <div a={a} />;
    }`,
    `let element = <div />`,
    // RC-1: same-named non-Solid types must not trigger the rule — the annotation is only a sound
    // component signal when it binds to a solid-js import (ADR-0002/0003).
    `interface Component { name: string }
    const make: Component = ({ name }) => name.toUpperCase();`,
    `type VoidComponent = (opts: { id: number }) => string;
    const build: VoidComponent = ({ id }) => "x" + id;`,
    `import { Component } from "./my-ui-kit";
    const widget: Component = ({ label }) => label;`,
    `type ParentComponent<T> = (a: T) => T;
    const tap: ParentComponent<{ v: number }> = ({ v }) => ({ v });`,
    // Cluster B: detection is by binding, not name. A destructuring helper whose name collides with
    // a host element (`<header>`) is not a component.
    `function header({ title }) {
      return title.toUpperCase();
    }
    const page = <header>{header({ title: "x" })}</header>;`,
    // Cluster B: a nested helper whose name collides with a component imported and rendered elsewhere
    // resolves to a different binding, so its destructure is not flagged.
    `import { Row } from "./grid";
    function build() {
      function Row(cfg) {
        const { gap } = cfg;
        return gap + 1;
      }
      return Row({ gap: 2 });
    }
    const view = <Row gap={2} />;`,
  ],
  invalid: [
    {
      // Body-level destructuring of the props param loses reactivity too (report-only, no autofix).
      code: `let Component: Component =props => {
      let { a } = props;
      return <div a={a} />;
    }`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({}) => <div />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div />`,
    },
    {
      // Real function declaration, detected as a component by its in-file `<Card/>` usage.
      code: `function Card({ title }) {
        return <h1>{title}</h1>;
      }
      const view = <Card title="x" />;`,
      errors: [{ messageId: "noDestructure" }],
      output: `function Card(props) {
        return <h1>{props.title}</h1>;
      }
      const view = <Card title="x" />;`,
    },
    {
      code: `let Component: Component =({ a }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div a={props.a} />`,
    },
    {
      code: `let Component: Component =({ a }) => (<div a={a} />)`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => (<div a={props.a} />)`,
    },
    {
      code: `let Component: Component =({ a: A }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div a={props.a} />`,
    },
    {
      code: `let Component: Component =({ 'a': A }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div a={props['a']} />`,
    },
    {
      code: `let Component: Component =({ ['a' + '']: a }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div a={props['a' + '']} />`,
    },
    {
      code: `let Component: Component =({ ['a' + '']: a, b }) => <div a={a} b={b} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props) => <div a={props['a' + '']} b={props.b} />`,
    },
    {
      code: `let Component: Component =({ a = 5 }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a: A = 5 }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ 'a': A = 5 }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ ['a' + '']: a = 5, b = 10, c }) => <div a={a} b={b} c={c} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge } from "solid-js";
let Component: Component =(_props) => {
        const props = merge({ a: 5 }, _props);
        return <div a={props.a} />;
      }`,
    },
    {
      code: `let Component: Component =({ a = 5 }) => {
        various();
        statements();
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge } from "solid-js";
let Component: Component =(_props) => {
        const props = merge({ a: 5 }, _props);
        various();
        statements();
        return <div a={props.a} />;
      }`,
    },
    {
      code: `let Component: Component =({ ...rest }) => <div a={rest.a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a, ...rest }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a, ...rest }) => (<div a={a} />)`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a, ...other }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a, ...rest }) => <div a={a} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a: A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ 'a': A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ ['a' + '']: A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ ['a' + '']: A, ...rest }) => <div a={A} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ a = 5, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge, omit } from "solid-js";
let Component: Component =(_props) => {
        const props = merge({ a: 5 }, _props);
        const rest = omit(props, "a");
        return <div a={props.a} b={rest.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ ...rest }) => {
        return <div a={rest.a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { omit } from "solid-js";
let Component: Component =(props) => {
        const rest = omit(props);
        return <div a={rest.a} />;
      }`,
    },
    {
      code: `let Component: Component =({ a, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { omit } from "solid-js";
let Component: Component =(props) => {
        const rest = omit(props, "a");
        return <div a={props.a} b={rest.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ a, ...other }) => {
        return <div a={a} b={other.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { omit } from "solid-js";
let Component: Component =(props) => {
        const other = omit(props, "a");
        return <div a={props.a} b={other.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ ['a' + '']: a, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { omit } from "solid-js";
let Component: Component =(props) => {
        const rest = omit(props, 'a' + '');
        return <div a={props['a' + '']} b={rest.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ ['a' + '']: a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge } from "solid-js";
let Component: Component =(_props) => {
        const props = merge({ ['a' + '']: 5 }, _props);
        return <div a={props['a' + '']} />;
      }`,
    },
    {
      code: `const merge = Object.assign;
      let Component: Component =({ a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: null,
    },
    {
      code: `let Component: Component =({ a = 5 }) => {
        const props = getFallbackProps();
        return <div a={a} b={props.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge } from "solid-js";
let Component: Component =(_props) => {
        const props2 = merge({ a: 5 }, _props);
        const props = getFallbackProps();
        return <div a={props2.a} b={props.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ a = 5 }) => {
        const _props = getFallbackProps();
        return <div a={a} b={_props.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `import { merge } from "solid-js";
let Component: Component =(_props2) => {
        const props = merge({ a: 5 }, _props2);
        const _props = getFallbackProps();
        return <div a={props.a} b={_props.b} />;
      }`,
    },
    {
      code: `let Component: Component =({ a = 5, ...rest }) => (<div a={a} b={rest.b} />)`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component: Component =({ ['a' + '']: A = 5, ...rest }) => <div a={A} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      // Review #4: a body-destructure of the props param is flagged even when the param has a
      // default value (`(props = {}) =>`), which wraps it in an AssignmentPattern.
      code: `const C: Component = (props = {}) => {
        const { a } = props;
        return <div>{a}</div>;
      }`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      // Nested bindings cannot be safely rewritten as direct props access. The report remains, but
      // the fixer must not remove the declaration of `name`.
      code: `const C: Component = ({ user: { name } }) => <div>{name}</div>;`,
      errors: [{ messageId: "noDestructure" }],
      output: null,
    },
  ],
});

ruleTester.run("no-destructure-ts", rule as never, {
  valid: [`let Component: Component =(props: Props) => <div />;`],
  invalid: [
    {
      code: `let Component: Component =({ prop1, prop2 }: Props) => <div p1={prop1} p2={prop2} />;`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component: Component =(props: Props) => <div p1={props.prop1} p2={props.prop2} />;`,
    },
  ],
});
