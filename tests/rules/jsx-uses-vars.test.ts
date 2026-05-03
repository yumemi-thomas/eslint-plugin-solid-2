import rule from "../../src/rules/jsx-uses-vars.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("jsx-uses-vars", rule as never, {
  valid: [`let X; markUsed(<X />)`, `let X; markUsed(<Namespace.X />)`],
  invalid: [],
});
