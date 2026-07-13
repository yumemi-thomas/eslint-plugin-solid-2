import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { bench } from "vite-plus/test";
import { plugin } from "../src/plugin.js";
import { recommendedRules, recommendedTypeCheckedRules } from "../src/rule-catalog.js";

const fixturesDir = fileURLToPath(new URL("../tests/fixtures", import.meta.url));
const filename = `${fixturesDir}/benchmark.tsx`;

const components = Array.from(
  { length: 40 },
  (_, index) => `
const Row${index}: Component<{ items: Item[]; visible: boolean }> = props => {
  const [selected, setSelected] = createSignal(0);
  const [store] = createStore({ label: "row-${index}" });
  const doubled = createMemo(() => selected() * 2);
  return <Show when={props.visible}>
    {() => <For each={props.items}>{(item, position) =>
      <button onClick={() => setSelected(position())}>{store.label}: {item.name}: {doubled()}</button>
    }</For>}
  </Show>;
};
const view${index} = <Row${index} items={[]} visible />;`,
).join("\n");

const source = `
import { For, Show, createMemo, createSignal, createStore, type Component } from "solid-js";
interface Item { name: string }
${components}
`;

function createVerifier(rules: Record<string, unknown>, typeAware: boolean): () => void {
  const linter = new Linter();
  const verify = (): void => {
    const messages = linter.verify(
      source,
      [
        {
          files: ["**/*.tsx"],
          plugins: { solid: plugin },
          rules,
          languageOptions: {
            parser: tsParser as never,
            parserOptions: typeAware
              ? {
                  projectService: {
                    allowDefaultProject: ["benchmark.tsx"],
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 100,
                  },
                  tsconfigRootDir: fixturesDir,
                }
              : {},
          },
        },
      ] as never,
      { filename },
    );
    const fatal = messages.find((message) => message.fatal || message.ruleId == null);
    if (fatal) {
      throw new Error(`Benchmark lint failed: ${fatal.message}`);
    }
  };
  verify();
  return verify;
}

const verifyRecommended = createVerifier(recommendedRules, false);
const verifyRecommendedTypeChecked = createVerifier(recommendedTypeCheckedRules, true);

bench("recommended: 40 representative components", verifyRecommended, {
  time: 500,
  warmupTime: 100,
});

bench("recommendedTypeChecked: 40 representative components", verifyRecommendedTypeChecked, {
  time: 500,
  warmupTime: 100,
});
