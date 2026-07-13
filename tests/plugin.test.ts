import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import solid from "../src/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const expectedRules = [
  "components-return-once",
  "jsx-no-duplicate-props",
  "no-destructure",
  "no-leaf-owner-operations",
  "no-owned-scope-writes",
  "no-reactive-read-after-await",
  "no-stale-props-alias",
  "no-untracked-read-in-effect-apply",
  "prefer-for",
  "prefer-show",
  "self-closing-comp",
];

describe("public plugin invariants", () => {
  it("registers every public rule with documentation", () => {
    expect(Object.keys(solid.rules)).toEqual(expectedRules);

    for (const name of expectedRules) {
      expect(existsSync(`${root}/docs/${name}.md`)).toBe(true);
    }
  });

  it("keeps flat config aliases identical", () => {
    expect(solid.configs["flat/recommended"]).toBe(solid.configs.recommended);
    expect(solid.configs["flat/recommended-type-checked"]).toBe(
      solid.configs["recommended-type-checked"],
    );
  });

  it("exposes the intended base and type-checked policy", () => {
    expect(solid.configs.recommended.rules).toEqual({
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
    });

    expect(solid.configs["recommended-type-checked"].rules).toEqual({
      ...solid.configs.recommended.rules,
      "solid/components-return-once": ["warn", { typescriptEnabled: true }],
      "solid/no-destructure": ["warn", { typescriptEnabled: true }],
      "solid/no-leaf-owner-operations": ["error", { typescriptEnabled: true }],
      "solid/no-owned-scope-writes": ["error", { typescriptEnabled: true }],
      "solid/no-reactive-read-after-await": ["warn", { typescriptEnabled: true }],
      "solid/no-stale-props-alias": ["warn", { typescriptEnabled: true }],
      "solid/no-untracked-read-in-effect-apply": ["warn", { typescriptEnabled: true }],
      "solid/prefer-for": ["warn", { typescriptEnabled: true }],
    });
  });

  it("documents every type-aware option", () => {
    const typedRules = Object.entries(solid.configs["recommended-type-checked"].rules)
      .filter(([, config]) => Array.isArray(config) && config[1]?.typescriptEnabled === true)
      .map(([name]) => name.slice("solid/".length));

    for (const name of typedRules) {
      expect(readFileSync(`${root}/docs/${name}.md`, "utf8")).toContain("typescriptEnabled");
    }
  });
});
