# `solid/no-store-proxy-in-effect-apply`

Disallow passing store proxies through effect compute functions and reading them in the apply callback.

Effect apply callbacks run untracked in Solid 2. If compute returns a store proxy or part of one, reading fields from that proxy in apply will not behave like a tracked read.

## Bad

```ts
createEffect(
  () => store.user,
  (user) => sendAnalytics(user.name, user.age),
);
```

```ts
createRenderEffect(
  () => store,
  (value) => console.log(value.user.name),
);
```

```ts
createEffect(
  () => store.user,
  (user) => {
    const { name } = user;
    console.log(name);
  },
);
```

```ts
createEffect(() => store.user, {
  effect(user) {
    console.log(user.name);
  },
});
```

## Good

```ts
createEffect(
  () => ({ name: store.user.name, age: store.user.age }),
  (value) => sendAnalytics(value.name, value.age),
);
```

```ts
createEffect(
  () => deep(store),
  (snapshot) => saveToLocalStorage(JSON.stringify(snapshot)),
);
```

```ts
createEffect(
  () => store.user,
  (user) => console.log(user),
);
```

```ts
createEffect(() => ({ name: store.user.name, age: store.user.age }), {
  effect(value) {
    sendAnalytics(value.name, value.age);
  },
});
```

## Notes

- Object-form effect bundles are also checked.
- Destructuring or spreading the apply parameter counts as a forbidden store-proxy read.
- Returning plain derived data from compute is the preferred pattern.
