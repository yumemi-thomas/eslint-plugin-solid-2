import rule from "../../src/rules/prefer-for.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("prefer-for", rule as never, {
  valid: [
    `let Component = (props) => <ol><For each={props.data}>{d => <li>{d().text}</li>}</For></ol>;`,
    `let abc = x.map(y => y + z);`,
    `let Component = (props) => {
      let abc = x.map(y => y + z);
      return <div>Hello, world!</div>;
    }`,
    `let Component = (props) => <ol>{props.data.map((d) => d.text)}</ol>;`,
  ],
  invalid: [
    {
      code: `let Component = (props) => <ol>{props.data.map(d => <li>{d.text}</li>)}</ol>;`,
      errors: [{ messageId: "preferFor" }],
      output: `let Component = (props) => <ol><For each={props.data}>{d => <li>{d().text}</li>}</For></ol>;`,
    },
    {
      code: `let Component = (props) => <>{props.data.map(d => <li>{d.text}</li>)}</>;`,
      errors: [{ messageId: "preferFor" }],
      output: `let Component = (props) => <><For each={props.data}>{d => <li>{d().text}</li>}</For></>;`,
    },
    {
      code: `let Component = (props) => <ol>{props.data.map((d, i) => <li>{d.text}{i}</li>)}</ol>;`,
      errors: [{ messageId: "preferFor" }],
      output: `let Component = (props) => <ol><For each={props.data}>{(d, i) => <li>{d().text}{i()}</li>}</For></ol>;`,
    },
    {
      code: `
      function Component(props) {
        return <ol>{props.data.map(d => <li>{d.text}</li>)}</ol>;
      }`,
      errors: [{ messageId: "preferFor" }],
      output: `
      function Component(props) {
        return <ol><For each={props.data}>{d => <li>{d().text}</li>}</For></ol>;
      }`,
    },
    {
      code: `
      function Component(props) {
        return <ol>{props.data?.map(d => <li>{d.text}</li>)}</ol>;
      }`,
      errors: [{ messageId: "preferFor" }],
      output: `
      function Component(props) {
        return <ol><For each={props.data}>{d => <li>{d().text}</li>}</For></ol>;
      }`,
    },
    {
      code: `let Component = (props) => <ol>{props.data.map(() => <li />)}</ol>;`,
      errors: [{ messageId: "preferFor" }],
      output: `let Component = (props) => <ol><For each={props.data}>{() => <li />}</For></ol>;`,
    },
    {
      code: `let Component = (props) => <ol>{props.data.map((d) => { return <li>{d}</li>; })}</ol>;`,
      errors: [{ messageId: "preferFor" }],
      output: `let Component = (props) => <ol><For each={props.data}>{(d) => { return <li>{d()}</li>; }}</For></ol>;`,
    },
    {
      code: `let Component = (props) => <ol>{props.data.map(({ text }) => <li>{text}</li>)}</ol>;`,
      errors: [{ messageId: "preferFor" }],
    },
    {
      code: `let Component = (props) => <ol>{props.data.map((...args) => <li>{args[0].text}</li>)}</ol>;`,
      errors: [{ messageId: "preferFor" }],
    },
  ],
});
