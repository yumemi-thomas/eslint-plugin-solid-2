import rule from "../../src/rules/prefer-for.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("prefer-for", rule as never, {
  valid: [
    `let Component = (props) => <ol><For each={props.data}>{d => <li>{d.text}</li>}</For></ol>;`,
    `let abc = x.map(y => y + z);`,
    `let Component = (props) => <ol>{props.data.map((d) => <li>{d.text}</li>)}</ol>;`,
    `let Component = (props) => <>{props.data.map(d => <li>{d.text}</li>)}</>;`,
    `function Component(props) {
      return <ol>{props.data?.map(d => <li>{d.text}</li>)}</ol>;
    }`,
    // Syntax alone cannot prove this is Array#map rather than another collection API. The
    // zero-FP AST config is deliberately silent; recommended-type-checked handles it.
    `const collection = getCollection();
    const view = <>{collection.map((item) => <Row item={item} />)}</>;`,
    // Static arrays do not benefit from reconciliation.
    `let Component = () => <ol>{["a", "b"].map(t => <li>{t}</li>)}</ol>;`,
    `const ITEMS = ["a", "b", "c"];
    let Component = () => <ol>{ITEMS.map(t => <li>{t}</li>)}</ol>;`,
    `let Component = () => <ol>{["a", "b"].filter(Boolean).map(t => <li>{t}</li>)}</ol>;`,
  ],
  invalid: [],
});
