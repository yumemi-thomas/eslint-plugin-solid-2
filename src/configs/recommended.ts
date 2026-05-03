import { plugin } from "../plugin.js";

type SolidRuleLevel = "off" | "warn" | "error";
export type SolidRuleConfig = SolidRuleLevel | [SolidRuleLevel, ...unknown[]];
export type SolidRuleMap = Record<string, SolidRuleConfig>;

const recommendedRules: SolidRuleMap = {
  "solid/components-return-once": "warn",
  "solid/jsx-no-duplicate-props": "error",
  "solid/jsx-no-script-url": "error",
  "solid/jsx-no-undef": "error",
  "solid/jsx-uses-vars": "error",
  "solid/no-array-handlers": "off",
  "solid/no-cleanup-in-forbidden-scope": "error",
  "solid/no-destructure": "warn",
  "solid/no-flush-in-forbidden-scope": "error",
  "solid/no-invalid-cleanup-return": "error",
  "solid/no-innerhtml": "error",
  "solid/no-owned-scope-writes": "error",
  "solid/no-primitives-in-forbidden-scope": "error",
  "solid/no-react-deps": "error",
  "solid/no-async-outside-loading-boundary": "warn",
  "solid/no-signal-in-effect-apply": "warn",
  "solid/no-store-proxy-in-effect-apply": "warn",
  "solid/no-untracked-reactive-read": "warn",
  "solid/no-unknown-namespaces": "error",
  "solid/prefer-for": "warn",
  "solid/prefer-show": "warn",
  "solid/self-closing-comp": "warn",
  "solid/style-prop": "warn",
};

const recommended = {
  name: "solid/recommended",
  plugins: {
    solid: plugin,
  },
  rules: recommendedRules,
};

export default recommended;
