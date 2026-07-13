import { rules } from "./rule-catalog.js";

export { rules };

export const plugin = {
  meta: {
    name: "eslint-plugin-solid",
  },
  rules,
};
