import recommended from "./configs/recommended.js";
import typescript from "./configs/typescript.js";
import { plugin } from "./plugin.js";

const pluginWithConfigs = {
  ...plugin,
  configs: {
    recommended: {
      plugins: ["solid"],
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      rules: recommended.rules,
    },
    typescript: {
      plugins: ["solid"],
      parserOptions: {
        sourceType: "module",
      },
      rules: typescript.rules,
    },
    "flat/recommended": recommended,
    "flat/typescript": typescript,
  },
};

export default pluginWithConfigs;
export { plugin, recommended, typescript };
