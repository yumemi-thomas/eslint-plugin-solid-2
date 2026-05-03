import rule from "../../src/rules/no-async-outside-loading-boundary.js";
import { typedRuleTester as ruleTester } from "../ruleTester.js";

ruleTester.run("no-async-outside-loading-boundary", rule as never, {
  valid: [
    // Wrapped in Loading
    `const user = createMemo(async () => fetchUser());
    const App = () => (
      <Loading fallback={<Spinner />}>
        <Profile user={user()} />
      </Loading>
    );`,

    // Nested inside Loading via intermediate element
    `const user = createMemo(async () => fetchUser());
    const App = () => (
      <Loading fallback={<Spinner />}>
        <div>
          <Profile user={user()} />
        </div>
      </Loading>
    );`,

    // Loading imported under a different name from @solidjs/web
    `import { Loading as Suspense } from "@solidjs/web";
    const user = createMemo(async () => fetchUser());
    const App = () => (
      <Suspense fallback={<Spinner />}>
        <Profile user={user()} />
      </Suspense>
    );`,

    // Non-async createMemo — no warning
    `const doubled = createMemo(() => count() * 2);
    const App = () => <div>{doubled()}</div>;`,

    // Async memo not read in JSX
    `const user = createMemo(async () => fetchUser());
    createEffect(() => user(), (value) => console.log(value));`,

    // createProjection wrapped in Loading
    `const data = createProjection(async () => fetchData(), null);
    const App = () => (
      <Loading fallback={<Spinner />}>
        <DataView data={data()} />
      </Loading>
    );`,

    // Read inside a JSX callback that itself is inside Loading
    `const user = createMemo(async () => fetchUser());
    const App = () => (
      <Loading fallback={<Spinner />}>
        <For each={ids()}>{(id) => <Profile key={id} user={user()} />}</For>
      </Loading>
    );`,

    // Promise-returning compute (non-async function) wrapped in Loading
    `const user = createMemo(() => fetchUser().then((r) => r.json()));
    const App = () => (
      <Loading fallback={<Spinner />}>
        <Profile user={user()} />
      </Loading>
    );`,

    // Function-form createSignal that is sync — no warning
    `const [doubled] = createSignal((prev = 0) => prev + 1);
    const App = () => <div>{doubled()}</div>;`,

    // Sync compute returning a plain object — no warning
    `const data = createMemo(() => ({ a: 1 }));
    const App = () => <div>{data().a}</div>;`,
  ],
  invalid: [
    // Direct JSX read without Loading
    {
      code: `const user = createMemo(async () => fetchUser());
      const App = () => <Profile user={user()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Inline JSX expression
    {
      code: `const user = createMemo(async () => fetchUser());
      const App = () => <div>{user().name}</div>;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // createProjection without Loading
    {
      code: `const data = createProjection(async () => fetchData(), null);
      const App = () => <DataView data={data()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Wrong boundary — a non-Loading wrapper doesn't count
    {
      code: `const user = createMemo(async () => fetchUser());
      const App = () => (
        <ErrorBoundary fallback={<Error />}>
          <Profile user={user()} />
        </ErrorBoundary>
      );`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Aliased import of createMemo
    {
      code: `import { createMemo as memo } from "solid-js";
      const user = memo(async () => fetchUser());
      const App = () => <Profile user={user()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Non-async compute that returns a `.then(...)` chain
    {
      code: `const user = createMemo(() => fetchUser().then((r) => r.json()));
      const App = () => <Profile user={user()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Non-async compute that returns Promise.resolve(...)
    {
      code: `const data = createMemo(() => Promise.resolve(42));
      const App = () => <div>{data()}</div>;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Function-form createSignal with async compute
    {
      code: `const [user] = createSignal(async () => fetchUser());
      const App = () => <Profile user={user()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },

    // Compute body uses await directly
    {
      code: `const user = createMemo(async () => {
        const response = await fetchUser();
        return response;
      });
      const App = () => <Profile user={user()} />;`,
      errors: [{ messageId: "asyncOutsideLoadingBoundary" }],
    },
  ],
});
