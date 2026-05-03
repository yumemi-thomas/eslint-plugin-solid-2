import { RuleTester } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { describe, it } from "vite-plus/test";

RuleTester.describe = describe;
RuleTester.it = it;

export const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

export const tsRuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parser: tsParser,
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

export const typedRuleTester = ruleTester as RuleTester;
export const typedTsRuleTester = tsRuleTester as RuleTester;
