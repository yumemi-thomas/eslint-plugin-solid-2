import rule from "../../src/rules/jsx-no-duplicate-props.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("jsx-no-duplicate-props", rule as never, {
  valid: [
    `let el = <div a="a" b="b" />`,
    // TypeScript already diagnoses syntactically duplicated JSX attributes; this rule only owns
    // Solid's competing-content semantics.
    `let el = <div a="a" a="aaaa" />`,
    `let el = <div class="blue" class="green" />`,
    `let el = <div children={<div />} />`,
    `let el = <div><div /></div>`,
    // Formatting whitespace, comments, and empty expressions do not constitute JSX content.
    `let el = <div innerHTML={html}>
      {/* documentation */}
    </div>`,
    `let el = <div textContent="hello">{}</div>`,
    // These names are ordinary props on components, not host content sinks.
    `let el = <Panel innerHTML="<p></p>"><span /></Panel>`,
    `let el = <Panel textContent="howdy"><span /></Panel>`,
  ],
  invalid: [
    {
      code: `let el = <div children={<div />}><div /></div>`,
      errors: [
        { messageId: "noDuplicateChildren", data: { used: "`props.children`, JSX children" } },
      ],
    },
    {
      code: `let el = <div innerHTML="<p></p>" textContent="howdy!" />`,
      errors: [
        {
          messageId: "noDuplicateChildren",
          data: { used: "`props.innerHTML`, `props.textContent`" },
        },
      ],
    },
  ],
});
