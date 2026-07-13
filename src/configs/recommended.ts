import { plugin } from "../plugin.js";
import { recommendedRules } from "../rule-catalog.js";

export type { SolidRuleConfig, SolidRuleMap } from "../rule-catalog.js";

const recommended = {
  name: "solid/recommended",
  plugins: {
    solid: plugin,
  },
  rules: recommendedRules,
};

export default recommended;
