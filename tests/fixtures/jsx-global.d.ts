// Minimal global JSX namespace so the type-aware tests can resolve component prop types via
// `getContextualType`. Permissive on purpose — it only needs to let TS match a JSX element to its
// component signature, not model Solid's real JSX types.
declare namespace JSX {
  type Element = any;
  interface IntrinsicElements {
    [name: string]: any;
  }
  interface ElementChildrenAttribute {
    children: Record<string, never>;
  }
}
