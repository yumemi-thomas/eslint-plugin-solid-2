import rule from "../../src/rules/components-return-once.js";
import { typedTsRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("components-return-once", rule as never, {
  valid: [
    `const Component: Component = () => {
      return <div />;
    }`,
    `function someFunc() {
      if (condition) {
        return 5;
      }
      return 10;
    }`,
    `function notAComponent() {
      if (condition) {
        return <div />;
      }
      return <div />;
    }`,
    `callback(() => {
      if (condition) {
        return <div />;
      }
      return <div />;
    });`,
    // An anonymous HOC-wrapped function isn't a provable component (no annotation, no name, not
    // used as <C/>), so it's not flagged — a tolerated false negative under sound detection.
    `HOC(() => {
      if (condition) {
        return <div />;
      }
      return <div />;
    });`,
    `const Component: Component = () => {
      const renderContent = () => {
        if (false) return <></>;
        return <></>;
      };
      return <>{renderContent()}</>;
    }`,
    `const Component: Component = () => {
      function renderContent() {
        if (false) return <></>;
        return <></>;
      }
      return <>{renderContent()}</>;
    }`,
    `const Component: Component = () => {
      const renderContent = () => {
        const renderContentInner = () => {
          // ifs in render functions are fine no matter what nesting level this is
          if (false) return;
          return <></>;
        };
        return <>{renderContentInner()}</>;
      };
      return <></>;
    }`,
    `const Component: Component = () => {
      return <>{hoisted()}</>;
      function hoisted() {
        return 'hoisted';
      }
    }`,
    `const Component: Component = () => {
      return <></>;
      const hoisted = 'hoisted';
    }`,
    `const Component: Component = () => {
      return <></>;
      class Hoisted {}
    }`,
    // Sound default: a bare, unannotated component used only in another file isn't detected,
    // so its early return isn't flagged. This is the tolerated false negative (close it by
    // annotating `Component`, using it as `<Standalone/>` in-file, or enabling typescriptEnabled).
    `function Standalone(props) {
      if (!props.show) return null;
      return <div>{props.body}</div>;
    }`,
    // RC-1: a same-named *local* type (not solid-js's Component) must not trigger the rule. The
    // annotation signal is only sound when the type binds to a solid-js import (ADR-0002/0003).
    `type Component = (props: unknown) => string;
    const formatCell: Component = (props) => (cond ? "yes" : "no");`,
    // RC-1: a qualified type from a foreign namespace shares only the rightmost name.
    `const handler: Ng.Component = (props) => (cond ? "a" : "b");`,
    // RC-1: an explicit solid-js import is still detected (stays an invalid case below); a non-Solid
    // import of the same name is not.
    `import { Component } from "./my-ui-kit";
    const widget: Component = (props) => (cond ? "a" : "b");`,
    // Cluster B: detection is by binding, not name. A helper whose name collides with a host element
    // (`<summary>`, `<title>`) is not a component.
    `function summary() {
      if (props.empty) return "Nothing here";
      return props.text;
    }
    const head = <summary>{summary()}</summary>;`,
    `function title() {
      if (missing) return "Untitled";
      return doc.name;
    }
    const head = <title>x</title>;`,
    // Cluster B: a config factory whose name is the root of a member tag (`<Theme.Provider>`) is not
    // itself the rendered component.
    `function Theme() {
      if (dark) return darkTheme;
      return lightTheme;
    }
    const tree = <Theme.Provider value={Theme()} />;`,
    // Cluster B: a nested helper whose name collides with a component rendered elsewhere resolves to
    // a different binding, so it is not flagged.
    `function badge() {
      const Status = () => {
        if (offline) return "offline";
        return "online";
      };
      return Status();
    }
    function Widget() {
      return <Status />;
    }`,
    // A static guard fixes the return shape at mount — nothing can go stale, so a conditional
    // return on it is correct Solid. `isServer`, `import.meta.env`, and module constants are the
    // canonical cases.
    `const Page: Component = () => {
      if (isServer) return <noscript />;
      return <div />;
    };`,
    `const Page: Component = () => {
      if (import.meta.env.DEV) return <section />;
      return <main />;
    };`,
    `const DEBUG = false;
    const Page: Component = () => {
      return DEBUG ? <aside /> : <main />;
    };`,
    `const Page: Component = () => {
      return 0 && <div>Conditional</div>;
    };`,
    // A guard we can't prove reactive (a helper call, a context read) is a tolerated false
    // negative — reporting it would flag correct code when the helper is non-reactive.
    `const Page: Component = () => {
      if (isLoggedIn()) return <a href="/app">Open</a>;
      return <a href="/login">Log in</a>;
    };`,
  ],
  invalid: [
    {
      // RC-1: an explicit solid-js import of the component type is detected (the positive path the
      // binding check must preserve).
      code: `import { Component } from "solid-js";
const Widget: Component = (props) => {
  return props.big ? <div>Big!</div> : <div>Small!</div>;
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      output: `import { Component } from "solid-js";
const Widget: Component = (props) => {
  return <>{props.big ? <div>Big!</div> : <div>Small!</div>}</>;
}`,
    },
    {
      // Real function declaration, detected as a component by its in-file `<Component/>` usage.
      code: `function Component(props) {
        if (props.error) {
          return <div />;
        }
        return <span />;
      }
      const view = <Component />;`,
      errors: [{ messageId: "noEarlyReturn" }],
    },
    {
      // A locally-declared signal read is a reactive guard.
      code: `const Component: Component = () => {
        const [failed] = createSignal(false);
        if (failed()) {
          return <div />;
        }
        return <span />;
        function hoisted() {}
      }`,
      errors: [{ messageId: "noEarlyReturn" }],
    },
    {
      // A guard derived from props through a const is still reactive.
      code: `const Component: Component = (props) => {
        const loading = props.loading;
        if (loading) {
          return <div />;
        }
        return <span />;
      }`,
      errors: [{ messageId: "noEarlyReturn" }],
    },
    {
      // A store member read is a reactive guard.
      code: `const Component: Component = () => {
  const [state] = createStore({ big: false });
  return state.big ? <div>Big!</div> : <div>Small!</div>;
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      output: `const Component: Component = () => {
  const [state] = createStore({ big: false });
  return <>{state.big ? <div>Big!</div> : <div>Small!</div>}</>;
}`,
    },
    {
      code: `const Component: Component = (props) => {
  return props.big ? <div>Big!</div> : "Small!";
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      output: `const Component: Component = (props) => {
  return <>{props.big ? <div>Big!</div> : "Small!"}</>;
}`,
    },
    {
      code: `const Component: Component = (props) => {
  return props.big ? (
    <div>
      Big!
      No, really big!
    </div>
  ) : <div>Small!</div>;
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      // The fix also inserts the `Show` import so the rewritten code compiles.
      output: `import { Show } from "solid-js";
const Component: Component = (props) => {
  return <Show when={props.big} fallback={<div>Small!</div>}><div>
      Big!
      No, really big!
    </div></Show>;
}`,
    },
    {
      code: `const Component: Component = (props) => {
  return props.cond1 ? (
    <div>Condition 1</div>
  ) : Boolean(props.cond2) ? (
    <div>Not condition 1, but condition 2</div>
  ) : (
    <div>Neither condition 1 or 2</div>
  );
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      // The fix also inserts the `Switch`/`Match` imports so the rewritten code compiles.
      output: `import { Switch, Match } from "solid-js";
const Component: Component = (props) => {
  return <Switch fallback={<div>Neither condition 1 or 2</div>}>
<Match when={props.cond1}><div>Condition 1</div></Match>
<Match when={Boolean(props.cond2)}><div>Not condition 1, but condition 2</div></Match>
</Switch>;
}`,
    },
    {
      code: `const Component: Component = (props) => {
  return !!props.cond && <div>Conditional</div>;
}`,
      errors: [{ messageId: "noConditionalReturn" }],
      output: null,
    },
    {
      code: `const Component: Component = (props) => {
  return props.primary || <div>{props.secondaryText}</div>;
}`,
      errors: [{ messageId: "noConditionalReturn" }],
    },
  ],
});
