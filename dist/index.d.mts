import * as _$_typescript_eslint_utils_ts_eslint0 from "@typescript-eslint/utils/ts-eslint";

//#region src/configs/recommended.d.ts
type SolidRuleLevel = "off" | "warn" | "error";
type SolidRuleConfig = SolidRuleLevel | [SolidRuleLevel, ...unknown[]];
type SolidRuleMap = Record<string, SolidRuleConfig>;
declare const recommended: {
  name: string;
  plugins: {
    solid: {
      meta: {
        name: string;
      };
      rules: {
        "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
          ignoreCase?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
          allowGlobals?: boolean;
          autoImport?: boolean;
          typescriptEnabled?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
          allowStatic?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
          allowedNamespaces?: string[];
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
          component?: "all" | "none";
          html?: "all" | "none" | "void";
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
          allowString?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
      };
    };
  };
  rules: SolidRuleMap;
};
//#endregion
//#region src/configs/typescript.d.ts
declare const typescript: {
  plugins: {
    solid: {
      meta: {
        name: string;
      };
      rules: {
        "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
          ignoreCase?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
          allowGlobals?: boolean;
          autoImport?: boolean;
          typescriptEnabled?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
          allowStatic?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
          allowedNamespaces?: string[];
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
          component?: "all" | "none";
          html?: "all" | "none" | "void";
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
        "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
          allowString?: boolean;
        } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
      };
    };
  };
  name: string;
  rules: SolidRuleMap;
};
//#endregion
//#region src/plugin.d.ts
declare const plugin: {
  meta: {
    name: string;
  };
  rules: {
    "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
      ignoreCase?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
      allowGlobals?: boolean;
      autoImport?: boolean;
      typescriptEnabled?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
      allowStatic?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
      allowedNamespaces?: string[];
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
      component?: "all" | "none";
      html?: "all" | "none" | "void";
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
      allowString?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
  };
};
//#endregion
//#region src/index.d.ts
declare const pluginWithConfigs: {
  meta: {
    name: string;
  };
  rules: {
    "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
      ignoreCase?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
      allowGlobals?: boolean;
      autoImport?: boolean;
      typescriptEnabled?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
      allowStatic?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
      allowedNamespaces?: string[];
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
      component?: "all" | "none";
      html?: "all" | "none" | "void";
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
    "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
      allowString?: boolean;
    } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
  };
  configs: {
    recommended: {
      plugins: string[];
      parserOptions: {
        ecmaFeatures: {
          jsx: boolean;
        };
      };
      rules: SolidRuleMap;
    };
    typescript: {
      plugins: string[];
      parserOptions: {
        sourceType: string;
      };
      rules: SolidRuleMap;
    };
    "flat/recommended": {
      name: string;
      plugins: {
        solid: {
          meta: {
            name: string;
          };
          rules: {
            "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
              ignoreCase?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
              allowGlobals?: boolean;
              autoImport?: boolean;
              typescriptEnabled?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
              allowStatic?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
              allowedNamespaces?: string[];
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
              component?: "all" | "none";
              html?: "all" | "none" | "void";
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
              allowString?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
          };
        };
      };
      rules: SolidRuleMap;
    };
    "flat/typescript": {
      plugins: {
        solid: {
          meta: {
            name: string;
          };
          rules: {
            "components-return-once": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noConditionalReturn" | "noEarlyReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-duplicate-props": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDuplicateChildren" | "noDuplicateClass" | "noDuplicateProps", [({
              ignoreCase?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-script-url": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noJSURL", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-no-undef": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"autoImport" | "undefined", [({
              allowGlobals?: boolean;
              autoImport?: boolean;
              typescriptEnabled?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "jsx-uses-vars": _$_typescript_eslint_utils_ts_eslint0.RuleModule<never, [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-array-handlers": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noArrayHandlers", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-cleanup-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noCleanupInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-destructure": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noDestructure", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-flush-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noFlushInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-invalid-cleanup-return": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noInvalidCleanupReturn", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-innerhtml": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"conflict" | "dangerous" | "dangerouslySetInnerHTML" | "notHtml" | "useInnerText", [({
              allowStatic?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-owned-scope-writes": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noOwnedScopeWrite", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-primitives-in-forbidden-scope": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noPrimitivesInForbiddenScope", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-react-deps": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noReactDepsEffect" | "noReactDepsMemo", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-async-outside-loading-boundary": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"asyncOutsideLoadingBoundary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-signal-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noSignalInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-store-proxy-in-effect-apply": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noStoreProxyInEffectApply", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-untracked-reactive-read": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"noUntrackedReactiveRead", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "no-unknown-namespaces": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"component" | "componentSuggest" | "removed" | "style" | "unknown", [({
              allowedNamespaces?: string[];
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "prefer-for": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferFor", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "prefer-show": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"preferShowAnd" | "preferShowTernary", [], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "self-closing-comp": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"dontSelfClose" | "selfClose", [({
              component?: "all" | "none";
              html?: "all" | "none" | "void";
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
            "style-prop": _$_typescript_eslint_utils_ts_eslint0.RuleModule<"invalidStyleProp" | "kebabStyleProp" | "numericStyleValue" | "stringStyle", [({
              allowString?: boolean;
            } | undefined)?], unknown, _$_typescript_eslint_utils_ts_eslint0.RuleListener>;
          };
        };
      };
      name: string;
      rules: SolidRuleMap;
    };
  };
};
//#endregion
export { pluginWithConfigs as default, plugin, recommended, typescript };