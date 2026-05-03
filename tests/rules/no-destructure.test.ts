import rule from "../../src/rules/no-destructure.js";
import { typedRuleTester as ruleTester, typedTsRuleTester as tsRuleTester } from "../ruleTester.js";

ruleTester.run("no-destructure", rule as never, {
  valid: [
    `let Component = props => <div />`,
    `let Component = (props) => <div />`,
    `let Component = (props) => { return <div />; }`,
    `let Component = (props) => (<div />)`,
    `let Component = props => null`,
    `let Component = (props) => <div a={props.a} />`,
    `let Component = (props) => {
      const rest = omit(props, "a");
      return <div a={props.a} b={rest.b} />;
    }`,
    `let Component = props => {
      const { a } = someFunction();
      return <div a={a} />
    }`,
    `let NotAComponent = ({ a }, more, params) => <div a={a} />`,
    `let Component = props => {
      let inner = ({ a, ...rest }) => a;
      let a = inner({ a: 5 });
      return <div a={a} />;
    }`,
    `let Component = props => {
      let { a } = props;
      return <div a={a} />;
    }`,
    `let element = <div />`,
  ],
  invalid: [
    {
      code: `let Component = ({}) => <div />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div />`,
    },
    {
      code: `let Component = ({ a }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div a={props.a} />`,
    },
    {
      code: `let Component = ({ a }) => (<div a={a} />)`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => (<div a={props.a} />)`,
    },
    {
      code: `let Component = ({ a: A }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div a={props.a} />`,
    },
    {
      code: `let Component = ({ 'a': A }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div a={props['a']} />`,
    },
    {
      code: `let Component = ({ ['a' + '']: a }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div a={props['a' + '']} />`,
    },
    {
      code: `let Component = ({ ['a' + '']: a, b }) => <div a={a} b={b} />`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => <div a={props['a' + '']} b={props.b} />`,
    },
    {
      code: `let Component = ({ a = 5 }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a: A = 5 }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ 'a': A = 5 }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ ['a' + '']: a = 5, b = 10, c }) => <div a={a} b={b} c={c} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (_props) => {
        const props = merge({ a: 5 }, _props);
        return <div a={props.a} />;
      }`,
    },
    {
      code: `let Component = ({ a = 5 }) => {
        various();
        statements();
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (_props) => {
        const props = merge({ a: 5 }, _props);
        various();
        statements();
        return <div a={props.a} />;
      }`,
    },
    {
      code: `let Component = ({ ...rest }) => <div a={rest.a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a, ...rest }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a, ...rest }) => (<div a={a} />)`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a, ...other }) => <div a={a} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a, ...rest }) => <div a={a} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a: A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ 'a': A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ ['a' + '']: A, ...rest }) => <div a={A} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ ['a' + '']: A, ...rest }) => <div a={A} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ a = 5, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (_props) => {
        const props = merge({ a: 5 }, _props);
        const rest = omit(props, "a");
        return <div a={props.a} b={rest.b} />;
      }`,
    },
    {
      code: `let Component = ({ ...rest }) => {
        return <div a={rest.a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => {
        const rest = omit(props);
        return <div a={rest.a} />;
      }`,
    },
    {
      code: `let Component = ({ a, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => {
        const rest = omit(props, "a");
        return <div a={props.a} b={rest.b} />;
      }`,
    },
    {
      code: `let Component = ({ a, ...other }) => {
        return <div a={a} b={other.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => {
        const other = omit(props, "a");
        return <div a={props.a} b={other.b} />;
      }`,
    },
    {
      code: `let Component = ({ ['a' + '']: a, ...rest }) => {
        return <div a={a} b={rest.b} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props) => {
        const rest = omit(props, 'a' + '');
        return <div a={props['a' + '']} b={rest.b} />;
      }`,
    },
    {
      code: `let Component = ({ ['a' + '']: a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (_props) => {
        const props = merge({ ['a' + '']: 5 }, _props);
        return <div a={props['a' + '']} />;
      }`,
    },
    {
      code: `const merge = Object.assign;
      let Component = ({ a = 5 }) => {
        return <div a={a} />;
      }`,
      errors: [{ messageId: "noDestructure" }],
      output: null,
    },
    {
      code: `let Component = ({ a = 5, ...rest }) => (<div a={a} b={rest.b} />)`,
      errors: [{ messageId: "noDestructure" }],
    },
    {
      code: `let Component = ({ ['a' + '']: A = 5, ...rest }) => <div a={A} b={rest.b} />`,
      errors: [{ messageId: "noDestructure" }],
    },
  ],
});

tsRuleTester.run("no-destructure-ts", rule as never, {
  valid: [`let Component = (props: Props) => <div />;`],
  invalid: [
    {
      code: `let Component = ({ prop1, prop2 }: Props) => <div p1={prop1} p2={prop2} />;`,
      errors: [{ messageId: "noDestructure" }],
      output: `let Component = (props: Props) => <div p1={props.prop1} p2={props.prop2} />;`,
    },
  ],
});
