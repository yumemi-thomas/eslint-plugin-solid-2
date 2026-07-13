import rule from "../../src/rules/no-stale-props-alias.js";
import { typedTsRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-stale-props-alias", rule as never, {
  valid: [
    // Only confirmed components are checked.
    `function helper(props) {
      const name = props.name;
      return <h1>{name}</h1>;
    }`,
    // Direct props reads in JSX are reactive.
    `const Card: Component = (props) => {
      return <h1>{props.name}</h1>;
    };`,
    // Destructured props are covered by no-destructure, not this rule.
    `const Card: Component = ({ name }) => {
      return <h1>{name}</h1>;
    };`,
    // Broad top-level reads may be intentional setup/debug/invariant work; this rule only targets
    // aliases that can accidentally be used as stale props.
    `const Card: Component = (props) => {
      console.log(props.name);
      return <h1>{props.name}</h1>;
    };`,
    // The canonical 2.0 defaults pattern: merge returns a reactive proxy, and passing the props
    // object to it is a passthrough, not a read.
    `import { merge } from "solid-js";
     const Card: Component = (_props) => {
       const props = merge({ size: "md" }, _props);
       return <h1>{props.size}</h1>;
     };`,
    // The canonical splitProps replacement.
    `import { omit } from "solid-js";
     const Card: Component = (props) => {
       const rest = omit(props, "class");
       return <div {...rest} />;
     };`,
    // A whole-object alias performs no read; property reads through it in JSX stay reactive.
    `const Card: Component = (props) => {
      const alias = props;
      return <h1>{alias.name}</h1>;
    };`,
    // Passing the props object to a helper is not provably an eager read (tolerated false negative).
    `const Card: Component = (props) => {
      const form = createForm(props);
      return <form>{form.fields}</form>;
    };`,
    // Explicitly untracked reads are intentional.
    `const Card: Component = (props) => {
      const name = untrack(() => props.name);
      return <h1>{name}</h1>;
    };`,
    `const Card: Component = (props) => {
      const readName = () => props.name;
      return <h1>{readName()}</h1>;
    };`,
    `const Card: Component = (props) => {
      const name = untrack(() => props.name ?? "Anonymous");
      return <h1>{name}</h1>;
    };`,
    // Local props-like values should not be confused with the first parameter binding.
    `const Card: Component = (props) => {
      const other = { name: "Ada" };
      const name = other.name;
      return <h1>{name}</h1>;
    };`,
    // Reassignable aliases are skipped; tracking flow through mutation is intentionally out of
    // scope for the zero-FP version.
    `const Card: Component = (props) => {
      let alias = props;
      alias = fallbackProps;
      const name = alias.name;
      return <h1>{name}</h1>;
    };`,
  ],
  invalid: [
    {
      code: `const Card: Component = (props) => {
        const name = props.name;
        return <h1>{name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const userName = props.user.name;
        return <h1>{userName}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "userName" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props["name"];
        return <h1>{name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `function Card(props) {
        const name = props.name;
        return <h1>{name}</h1>;
      }
      const view = <Card name="Ada" />;`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props.name;
        validate(name);
        return <h1>{props.name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props.name;
        return untrack(() => <h1>{name}</h1>);
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props.name;
        const render = () => <h1>{name}</h1>;
        return <>{render()}</>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props.name;
        const label = createMemo(() => name.toUpperCase());
        return <h1>{label()}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const name = props.name ?? "Anonymous";
        return <h1>{name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: "const Card: Component = (props) => {\n        const greeting = `Hello, ${props.name}`;\n        return <h1>{greeting}</h1>;\n      };",
      errors: [{ messageId: "stalePropsAlias", data: { name: "greeting" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const user = { name: props.name };
        return <h1>{user.name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "user" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const label = formatName(props.name);
        return <h1>{label}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "label" } }],
    },
    {
      code: `const Card: Component = (props) => {
        const alias = props;
        const name = alias.name;
        return <h1>{name}</h1>;
      };`,
      // `const alias = props` itself performs no read (a whole-object alias stays reactive), so
      // only the eager read through it is reported.
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      // A read from a merge/omit result is a stale read like any other props read.
      code: `import { merge } from "solid-js";
      const Card: Component = (_props) => {
        const props = merge({ size: "md" }, _props);
        const size = props.size;
        return <h1>{size}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "size" } }],
    },
    {
      // An eager props read inside a merge/omit call is still a stale read; only the bare props
      // argument is a reactive passthrough.
      code: `import { merge } from "solid-js";
      const Card: Component = (props) => {
        const merged = merge({ name: props.name }, props);
        return <h1>{merged.name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "merged" } }],
    },
    {
      // Spreading props reads every property eagerly.
      code: `const Card: Component = (props) => {
        const copy = { ...props };
        return <h1>{copy.name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "copy" } }],
    },
    {
      // Computed access is an eager read too.
      code: `const Card: Component = (props) => {
        const value = props[key];
        return <h1>{value}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "value" } }],
    },
    {
      code: `const Card: Component = (props) => {
        let name;
        name = props.name;
        return <h1>{name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
    {
      code: `const Card: Component = (props) => {
        let name = "Anonymous";
        name = props.name ?? name;
        return <h1>{name}</h1>;
      };`,
      errors: [{ messageId: "stalePropsAlias", data: { name: "name" } }],
    },
  ],
});
