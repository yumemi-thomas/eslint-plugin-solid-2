import recommended from "./configs/recommended.js";
import recommendedTypeChecked from "./configs/recommended-type-checked.js";
import { plugin } from "./plugin.js";

// A single TypeScript-only flat config. Every rule works from the AST/scope, so `recommended` runs
// under both ESLint and oxlint. `recommendedTypeChecked` additionally turns on the opt-in
// type-aware paths (slower; needs ESLint type information). `flat/*` aliases aid discoverability.
const pluginWithConfigs = {
  ...plugin,
  configs: {
    recommended,
    "flat/recommended": recommended,
    "recommended-type-checked": recommendedTypeChecked,
    "flat/recommended-type-checked": recommendedTypeChecked,
  },
};

export default pluginWithConfigs;
