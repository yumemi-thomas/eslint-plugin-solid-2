# `solid/no-async-outside-loading-boundary`

Warn when async computations are read in JSX without a `<Loading>` boundary.

When an async computation is read inside JSX with no `<Loading>` ancestor, Solid 2 emits the `ASYNC_OUTSIDE_LOADING_BOUNDARY` dev warning and defers the root mount until the async value settles. The app still works, but the mount container stays empty until all uncaught async resolves. Wrapping with `<Loading>` gives explicit fallback UI and enables progressive mounting.

## Bad

```tsx
const user = createMemo(async () => fetchUser(id()));

function App() {
  return <Profile user={user()} />;
}
```

```tsx
const data = createProjection(async () => fetchData(), null);

function App() {
  return <DataView data={data()} />;
}
```

```tsx
const user = createMemo(async () => fetchUser(id()));

function App() {
  // <Errored> is not a loading boundary
  return (
    <Errored fallback={<Error />}>
      <Profile user={user()} />
    </Errored>
  );
}
```

## Good

```tsx
const user = createMemo(async () => fetchUser(id()));

function App() {
  return (
    <Loading fallback={<Spinner />}>
      <Profile user={user()} />
    </Loading>
  );
}
```

```tsx
const user = createMemo(async () => fetchUser(id()));

function App() {
  // <Loading> outside a <For> callback still counts
  return (
    <Loading fallback={<Spinner />}>
      <For each={ids()}>{(id) => <Profile user={user()} />}</For>
    </Loading>
  );
}
```

```tsx
// Aliased import is recognised
import { Loading as Boundary } from "@solidjs/web";
const user = createMemo(async () => fetchUser(id()));

function App() {
  return (
    <Boundary fallback={<Spinner />}>
      <Profile user={user()} />
    </Boundary>
  );
}
```

## Notes

- Detection covers `createMemo`, `createProjection`, and the function-form of `createSignal`. The compute is treated as async when it is declared `async`, returns a `.then(...)` / `Promise.X(...)` / `new Promise(...)`, or uses `await`. Without type information, a sync function that calls a Promise-returning helper bound to a plain identifier (e.g. `() => fetchUser()`) is not flagged.
- The function-form of `createStore` is not tracked: its accessor is a proxy read through member expressions, so JSX reads cannot be statically located.
- A `<Loading>` outside a JSX callback (e.g. `<For>` or `<Show>` children) is correctly recognised as a valid boundary.
- The rule stops at component function boundaries and does not look into parent components.
- `<Loading>` is recognised by its canonical name and any alias imported from `@solidjs/web`.
- The runtime diagnostic only fires during the synchronous body of `render()` / `hydrate()`; post-mount route transitions do not emit it. The lint rule cannot statically distinguish those call sites and will warn on any unguarded async read in JSX.
