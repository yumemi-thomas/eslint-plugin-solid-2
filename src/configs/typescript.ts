import recommended, { type SolidRuleMap } from "./recommended.js";

const typescriptRules: SolidRuleMap = {
  ...recommended.rules,
  "solid/jsx-no-undef": ["error", { typescriptEnabled: true }],
};

const typescript = {
  ...recommended,
  name: "solid/typescript",
  rules: typescriptRules,
};

export default typescript;
