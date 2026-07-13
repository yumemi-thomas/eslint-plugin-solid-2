import rule from "../../src/rules/no-reactive-read-after-await.js";
import { typedRuleTester as ruleTester, typedTsRuleTester as tsRuleTester } from "../ruleTester.js";

// The async primitive in Solid 2.0 is an async compute passed to createMemo / createEffect /
// createRenderEffect / createProjection (there is no `createAsync`). createMemo is used as the
// representative wrapper here.
ruleTester.run("no-reactive-read-after-await", rule as never, {
  valid: [
    // ===== reads positioned before the await are tracked ==================================
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      const c = count();
      await fetch("/x");
      return c;
    });`,
    // Multiple reads, all before the await.
    `const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    createMemo(async () => {
      const x = a();
      const y = b();
      await fetch("/x");
      return x + y;
    });`,
    // A non-await statement between the read and the await doesn't change anything.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      const c = count();
      console.log("loading");
      await fetch("/x");
      return c;
    });`,
    // Read before the await, inside a nested block.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      {
        const c = count();
        await fetch("/x");
        return c;
      }
    });`,
    // An accessor used AS the awaited expression is read synchronously, before suspending.
    `const value = createMemo(() => 1);
    createMemo(async () => {
      return await value();
    });`,
    // An accessor read inside the awaited call's arguments runs before the suspend.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      const r = await fetch("/x?n=" + count());
      return r;
    });`,

    // ===== async function with no await at all runs synchronously =========================
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      return count();
    });`,

    // ===== explicit opt-out via untrack ===================================================
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      await fetch("/x");
      return untrack(() => count());
    });`,
    `const [count, setCount] = createSignal(0);
    const c = count;
    createMemo(async () => {
      await fetch("/x");
      return untrack(() => c());
    });`,

    // ===== not a reactive read ============================================================
    // Plain (non-accessor) function called after await.
    `const getThing = () => 1;
    createMemo(async () => {
      await fetch("/x");
      return getThing();
    });`,
    // Calling the *setter* after await is a write, not a tracked read.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      await fetch("/x");
      setCount(1);
    });`,
    // Store proxies are read via member access, not a call — out of scope, no false positive.
    `const [store] = createStore({ n: 0 });
    createMemo(async () => {
      await fetch("/x");
      return store.n;
    });`,

    // ===== sync compute is never flagged ==================================================
    `const [count, setCount] = createSignal(0);
    const double = createMemo(() => count() * 2);`,
    `const [count, setCount] = createSignal(0);
    createEffect(() => {
      console.log(count());
    });`,
    // A read inside a nested *synchronous* reactive scope is tracked by that scope, even when the
    // scope itself is created after the await.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      await fetch("/x");
      createEffect(() => console.log(count()));
      return 1;
    });`,

    // ===== context boundaries =============================================================
    // The compute factory is a local function, not Solid's.
    `const [count, setCount] = createSignal(0);
    const createMemo = (fn) => fn;
    createMemo(async () => {
      await fetch("/x");
      return count();
    });`,
    // A standalone async function (not a reactive compute callback).
    `const [count, setCount] = createSignal(0);
    async function load() {
      await fetch("/x");
      return count();
    }`,
    // The async *apply* callback (arg 1) belongs to no-untracked-read-in-effect-apply, not here.
    `const [count, setCount] = createSignal(0);
    createEffect(
      () => count(),
      async (value) => {
        await fetch("/x");
        console.log(count());
      },
    );`,
    // A read inside a nested closure isn't analyzed (we can't know when the helper runs).
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      await fetch("/x");
      const helper = async () => count();
      return helper();
    });`,
    // A nested async IIFE after the await is a separate closure.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      await fetch("/x");
      (async () => count())();
    });`,
    // A parameter that shadows the outer signal is a different binding.
    `const [count, setCount] = createSignal(0);
    createMemo(async (count) => {
      await fetch("/x");
      return count();
    });`,

    // ===== documented soundness boundaries (tolerated false negatives) ====================
    // await reached only on one branch is not treated as guaranteed.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      if (cond) {
        await fetch("/x");
      }
      return count();
    });`,
    // await buried in a loop body / for-init is not treated as guaranteed.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      for (let i = 0; i < 3; i++) {
        await fetch("/x");
      }
      return count();
    });`,
    // await on the right of a short-circuit is conditional.
    `const [count, setCount] = createSignal(0);
    createMemo(async () => {
      cond && (await fetch("/x"));
      return count();
    });`,

    // ===== independent computations don't cross-contaminate ===============================
    `const [a, setA] = createSignal(0);
    const [b, setB] = createSignal(0);
    createMemo(async () => {
      const x = a();
      await fetch("/x");
      return x;
    });
    createMemo(async () => {
      const y = b();
      await fetch("/y");
      return y;
    });`,
  ],

  invalid: [
    // ===== one row per reactive primitive =================================================
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "count" } }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createEffect(async () => {
        await fetch("/x");
        console.log(count());
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    {
      code: `const [count, setCount] = createSignal(0);
      createRenderEffect(async () => {
        await fetch("/x");
        console.log(count());
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // createProjection's draft callback runs tracked — a signal read after its await is lost.
    {
      code: `const [count, setCount] = createSignal(0);
      createProjection(async (draft) => {
        await fetch("/x");
        draft.value = count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "count" } }],
    },

    // ===== different accessor sources =====================================================
    // memo accessor
    {
      code: `const double = createMemo(() => 2);
      createMemo(async () => {
        await fetch("/x");
        return double();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "double" } }],
    },
    // createOptimistic getter
    {
      code: `const [opt, setOpt] = createOptimistic(0);
      createMemo(async () => {
        await fetch("/x");
        return opt();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "opt" } }],
    },
    // a signal created locally inside the callback is still untracked after the await
    {
      code: `createMemo(async () => {
        const [c, setC] = createSignal(0);
        await fetch("/x");
        return c();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "c" } }],
    },
    // accessor aliased through a const
    {
      code: `const [count, setCount] = createSignal(0);
      const c = count;
      createMemo(async () => {
        await fetch("/x");
        return c();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "c" } }],
    },
    // alias chain c -> count, d -> c
    {
      code: `const [count, setCount] = createSignal(0);
      const c = count;
      const d = c;
      createMemo(async () => {
        await fetch("/x");
        return d();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "d" } }],
    },
    // reading a nested memo's accessor after await is itself untracked by the outer computation
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        const d = createMemo(() => count());
        return d();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "d" } }],
    },

    // ===== await shapes that count as "guaranteed" ========================================
    // const x = await ...
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        const data = await fetch("/x");
        return data + count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // bare assignment: x = await ...
    {
      code: `let data;
      const [count, setCount] = createSignal(0);
      createMemo(async () => {
        data = await fetch("/x");
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // await passed as a call argument
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        console.log(await fetch("/x"));
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // await in an object literal property initializer
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        const data = { user: await fetch("/x") };
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // await in a template interpolation
    {
      code: "const [count, setCount] = createSignal(0);\ncreateMemo(async () => {\n  const url = `/api/${await getId()}`;\n  return count();\n});",
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // await in an unconditional nested block dominates a later read
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        {
          await fetch("/x");
        }
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },

    // ===== the read's position relative to the await ======================================
    // read after the *second* of two awaits; the read before the first is fine — exactly one error
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createMemo(async () => {
        const x = a();
        await fetch("/x");
        await fetch("/y");
        return x + b();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "b" } }],
    },
    // a read in the awaited argument is fine; a read after is flagged — exactly one error, on line 4
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await delay(count());
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", line: 4 }],
    },
    // two distinct reads after the await — both flagged, in source order
    {
      code: `const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        return a() + b();
      });`,
      errors: [
        { messageId: "reactiveReadAfterAwait", data: { name: "a" } },
        { messageId: "reactiveReadAfterAwait", data: { name: "b" } },
      ],
    },

    // ===== control-flow forms after a dominating await ====================================
    // inside a try block
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        try {
          return count();
        } catch {
          return 0;
        }
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // inside an if consequent (no block) after the await
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        if (ok) return count();
        return 0;
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // in a ternary branch
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        return ok ? count() : 0;
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // on the right of a logical expression
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        return ok && count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // deeply nested blocks below the await
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => {
        await fetch("/x");
        {
          {
            return count();
          }
        }
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
    // comma-sequence arrow body: (await x, read())
    {
      code: `const [count, setCount] = createSignal(0);
      createMemo(async () => (await fetch("/x"), count()));`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
  ],
});

// TypeScript-syntax cases: type annotations and `as` casts must not break detection.
tsRuleTester.run("no-reactive-read-after-await (typescript)", rule as never, {
  valid: [
    `const [count, setCount] = createSignal<number>(0);
    const data = createMemo(async (): Promise<number> => {
      const c = count();
      await fetch("/x");
      return c;
    });`,
  ],
  invalid: [
    {
      code: `const [count, setCount] = createSignal<number>(0);
      const data = createMemo(async (): Promise<number> => {
        await fetch("/x");
        return count();
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait", data: { name: "count" } }],
    },
    // an `as` cast around the read doesn't hide it
    {
      code: `const [count, setCount] = createSignal<number>(0);
      createMemo(async () => {
        await fetch("/x");
        return count() as number;
      });`,
      errors: [{ messageId: "reactiveReadAfterAwait" }],
    },
  ],
});
