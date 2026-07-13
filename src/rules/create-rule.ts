import { ESLintUtils } from "@typescript-eslint/utils";

// Each rule's `meta.docs.url` links directly to its public documentation page.
const DOCS_BASE = "https://github.com/yumemi-thomas/eslint-plugin-solid-2/blob/main/docs";

export const createRule = ESLintUtils.RuleCreator((name) => `${DOCS_BASE}/${name}.md`);
