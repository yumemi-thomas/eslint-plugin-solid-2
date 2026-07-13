import { plugin } from "../plugin.js";

type SolidRuleLevel = "off" | "warn" | "error";
export type SolidRuleConfig = SolidRuleLevel | [SolidRuleLevel, ...unknown[]];
export type SolidRuleMap = Record<string, SolidRuleConfig>;

const recommendedRules: SolidRuleMap = {
  "solid/components-return-once": "warn",
  "solid/jsx-no-duplicate-props": "error",
  "solid/no-destructure": "warn",
  "solid/no-leaf-owner-operations": "error",
  "solid/no-owned-scope-writes": "error",
  "solid/no-reactive-read-after-await": "warn",
  "solid/no-stale-props-alias": "warn",
  "solid/no-untracked-read-in-effect-apply": "warn",
  "solid/prefer-show": "warn",
  "solid/self-closing-comp": "warn",
};

const recommended = {
  name: "solid/recommended",
  plugins: {
    solid: plugin,
  },
  rules: recommendedRules,
};

export default recommended;
