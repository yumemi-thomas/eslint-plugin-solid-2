import { plugin } from "../plugin.js";
import { recommendedTypeCheckedRules } from "../rule-catalog.js";

// `recommended` plus the type-aware paths turned on, mirroring typescript-eslint's
// `recommendedTypeChecked`. Requires ESLint type information (`parserOptions.projectService` or
// `project`) and is slower. The type-aware paths are purely additive (ADR-0002 / ADR-0005): they
// find more, never flip a verdict on correct code — so there is no corrective variance vs
// `recommended`. The per-rule `typescriptEnabled` option is the mechanism; this config is the door.
const recommendedTypeChecked = {
  name: "solid/recommended-type-checked",
  plugins: {
    solid: plugin,
  },
  rules: recommendedTypeCheckedRules,
};

export default recommendedTypeChecked;
