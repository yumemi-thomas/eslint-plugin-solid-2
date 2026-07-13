import { plugin } from "../plugin.js";
import recommended, { type SolidRuleMap } from "./recommended.js";

// `recommended` plus the type-aware paths turned on, mirroring typescript-eslint's
// `recommendedTypeChecked`. Requires ESLint type information (`parserOptions.projectService` or
// `project`) and is slower. The type-aware paths are purely additive (ADR-0002 / ADR-0005): they
// find more, never flip a verdict on correct code — so there is no corrective variance vs
// `recommended`. The per-rule `typescriptEnabled` option is the mechanism; this config is the door.
const typeAwareOverrides: SolidRuleMap = {
  "solid/components-return-once": ["warn", { typescriptEnabled: true }],
  "solid/no-destructure": ["warn", { typescriptEnabled: true }],
  "solid/no-owned-scope-writes": ["error", { typescriptEnabled: true }],
  "solid/no-reactive-read-after-await": ["warn", { typescriptEnabled: true }],
  // Receiver identity is undecidable from syntax alone: only recommend `<For>` after TypeScript
  // proves this is Array#map rather than an unrelated collection's `.map` method.
  "solid/prefer-for": ["warn", { typescriptEnabled: true }],
};

const recommendedTypeChecked = {
  name: "solid/recommended-type-checked",
  plugins: {
    solid: plugin,
  },
  rules: {
    ...recommended.rules,
    ...typeAwareOverrides,
  },
};

export default recommendedTypeChecked;
