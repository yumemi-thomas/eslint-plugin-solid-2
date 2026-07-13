import componentsReturnOnce from "./rules/components-return-once.js";
import jsxNoDuplicateProps from "./rules/jsx-no-duplicate-props.js";
import noDestructure from "./rules/no-destructure.js";
import noLeafOwnerOperations from "./rules/no-leaf-owner-operations.js";
import noOwnedScopeWrites from "./rules/no-owned-scope-writes.js";
import noReactiveReadAfterAwait from "./rules/no-reactive-read-after-await.js";
import noStalePropsAlias from "./rules/no-stale-props-alias.js";
import noUntrackedReadInEffectApply from "./rules/no-untracked-read-in-effect-apply.js";
import preferFor from "./rules/prefer-for.js";
import preferShow from "./rules/prefer-show.js";
import selfClosingComp from "./rules/self-closing-comp.js";

export const rules = {
  "components-return-once": componentsReturnOnce,
  "jsx-no-duplicate-props": jsxNoDuplicateProps,
  "no-destructure": noDestructure,
  "no-leaf-owner-operations": noLeafOwnerOperations,
  "no-owned-scope-writes": noOwnedScopeWrites,
  "no-reactive-read-after-await": noReactiveReadAfterAwait,
  "no-stale-props-alias": noStalePropsAlias,
  "no-untracked-read-in-effect-apply": noUntrackedReadInEffectApply,
  "prefer-for": preferFor,
  "prefer-show": preferShow,
  "self-closing-comp": selfClosingComp,
};

export const plugin = {
  meta: {
    name: "eslint-plugin-solid",
  },
  rules,
};
