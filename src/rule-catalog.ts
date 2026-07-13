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

export type SolidRuleLevel = "off" | "warn" | "error";
export type SolidRuleConfig = SolidRuleLevel | readonly [SolidRuleLevel, ...unknown[]];
export type SolidRuleMap = Record<string, SolidRuleConfig>;

/**
 * The authoritative internal catalog for public rule registration and recommendation policy.
 * Documentation remains hand-authored and is verified through public-interface invariant tests.
 */
const ruleCatalog = {
  "components-return-once": {
    rule: componentsReturnOnce,
    recommended: "warn",
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "jsx-no-duplicate-props": {
    rule: jsxNoDuplicateProps,
    recommended: "error",
  },
  "no-destructure": {
    rule: noDestructure,
    recommended: "warn",
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "no-leaf-owner-operations": {
    rule: noLeafOwnerOperations,
    recommended: "error",
    recommendedTypeChecked: ["error", { typescriptEnabled: true }],
  },
  "no-owned-scope-writes": {
    rule: noOwnedScopeWrites,
    recommended: "error",
    recommendedTypeChecked: ["error", { typescriptEnabled: true }],
  },
  "no-reactive-read-after-await": {
    rule: noReactiveReadAfterAwait,
    recommended: "warn",
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "no-stale-props-alias": {
    rule: noStalePropsAlias,
    recommended: "warn",
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "no-untracked-read-in-effect-apply": {
    rule: noUntrackedReadInEffectApply,
    recommended: "warn",
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "prefer-for": {
    rule: preferFor,
    recommendedTypeChecked: ["warn", { typescriptEnabled: true }],
  },
  "prefer-show": {
    rule: preferShow,
    recommended: "warn",
  },
  "self-closing-comp": {
    rule: selfClosingComp,
    recommended: "warn",
  },
} as const;

type CatalogEntry = (typeof ruleCatalog)[keyof typeof ruleCatalog];

export const rules = Object.fromEntries(
  Object.entries(ruleCatalog).map(([name, entry]) => [name, entry.rule]),
) as { [Name in keyof typeof ruleCatalog]: (typeof ruleCatalog)[Name]["rule"] };

function buildRuleMap(policy: "recommended" | "recommendedTypeChecked"): SolidRuleMap {
  return Object.fromEntries(
    Object.entries(ruleCatalog).flatMap(([name, entry]) => {
      const typedEntry = entry as CatalogEntry & {
        recommended?: SolidRuleConfig;
        recommendedTypeChecked?: SolidRuleConfig;
      };
      const config =
        policy === "recommended"
          ? typedEntry.recommended
          : (typedEntry.recommendedTypeChecked ?? typedEntry.recommended);
      return config == null ? [] : [[`solid/${name}`, config]];
    }),
  );
}

export const recommendedRules = buildRuleMap("recommended");
export const recommendedTypeCheckedRules = buildRuleMap("recommendedTypeChecked");
