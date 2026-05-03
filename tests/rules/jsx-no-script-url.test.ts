import rule from "../../src/rules/jsx-no-script-url.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("jsx-no-script-url", rule as never, {
  valid: [
    `let el = <a href="https://example.com" />`,
    `let el = <Link to="https://example.com" />`,
    `let el = <Foo bar="https://example.com" />`,
    `const link = "https://example.com";
    let el = <a href={link} />`,
  ],
  invalid: [
    {
      code: `let el = <a href="javascript:alert('hacked!')" />`,
      errors: [{ messageId: "noJSURL" }],
    },
    {
      code: `let el = <Link to="javascript:alert('hacked!')" />`,
      errors: [{ messageId: "noJSURL" }],
    },
    {
      code: `let el = <Foo bar="javascript:alert('hacked!')" />`,
      errors: [{ messageId: "noJSURL" }],
    },
    {
      code: `const link = "javascript:alert('hacked!')";
    let el = <a href={link} />`,
      errors: [{ messageId: "noJSURL" }],
    },
    {
      code: `const link = "\\tj\\na\\tv\\na\\ts\\nc\\tr\\ni\\tpt:alert('hacked!')";
    let el = <a href={link} />`,
      errors: [{ messageId: "noJSURL" }],
    },
    {
      code: `const link = "javascrip" + "t:alert('hacked!')";
    let el = <a href={link} />`,
      errors: [{ messageId: "noJSURL" }],
    },
  ],
});
