import componentsReturnOnce from "./rules/components-return-once.js";
import jsxNoDuplicateProps from "./rules/jsx-no-duplicate-props.js";
import jsxNoScriptUrl from "./rules/jsx-no-script-url.js";
import jsxNoUndef from "./rules/jsx-no-undef.js";
import jsxUsesVars from "./rules/jsx-uses-vars.js";
import noArrayHandlers from "./rules/no-array-handlers.js";
import noCleanupInForbiddenScope from "./rules/no-cleanup-in-forbidden-scope.js";
import noDestructure from "./rules/no-destructure.js";
import noFlushInForbiddenScope from "./rules/no-flush-in-forbidden-scope.js";
import noInvalidCleanupReturn from "./rules/no-invalid-cleanup-return.js";
import noInnerhtml from "./rules/no-innerhtml.js";
import noOwnedScopeWrites from "./rules/no-owned-scope-writes.js";
import noPrimitivesInForbiddenScope from "./rules/no-primitives-in-forbidden-scope.js";
import noReactDeps from "./rules/no-react-deps.js";
import noAsyncOutsideLoadingBoundary from "./rules/no-async-outside-loading-boundary.js";
import noSignalInEffectApply from "./rules/no-signal-in-effect-apply.js";
import noStoreProxyInEffectApply from "./rules/no-store-proxy-in-effect-apply.js";
import noUntrackedReactiveRead from "./rules/no-untracked-reactive-read.js";
import noUnknownNamespaces from "./rules/no-unknown-namespaces.js";
import preferFor from "./rules/prefer-for.js";
import preferShow from "./rules/prefer-show.js";
import selfClosingComp from "./rules/self-closing-comp.js";
import styleProp from "./rules/style-prop.js";

export const rules = {
  "components-return-once": componentsReturnOnce,
  "jsx-no-duplicate-props": jsxNoDuplicateProps,
  "jsx-no-script-url": jsxNoScriptUrl,
  "jsx-no-undef": jsxNoUndef,
  "jsx-uses-vars": jsxUsesVars,
  "no-array-handlers": noArrayHandlers,
  "no-cleanup-in-forbidden-scope": noCleanupInForbiddenScope,
  "no-destructure": noDestructure,
  "no-flush-in-forbidden-scope": noFlushInForbiddenScope,
  "no-invalid-cleanup-return": noInvalidCleanupReturn,
  "no-innerhtml": noInnerhtml,
  "no-owned-scope-writes": noOwnedScopeWrites,
  "no-primitives-in-forbidden-scope": noPrimitivesInForbiddenScope,
  "no-react-deps": noReactDeps,
  "no-async-outside-loading-boundary": noAsyncOutsideLoadingBoundary,
  "no-signal-in-effect-apply": noSignalInEffectApply,
  "no-store-proxy-in-effect-apply": noStoreProxyInEffectApply,
  "no-untracked-reactive-read": noUntrackedReactiveRead,
  "no-unknown-namespaces": noUnknownNamespaces,
  "prefer-for": preferFor,
  reactivity: noUntrackedReactiveRead,
  "prefer-show": preferShow,
  "self-closing-comp": selfClosingComp,
  "style-prop": styleProp,
};

export const plugin = {
  meta: {
    name: "eslint-plugin-solid",
  },
  rules,
};
