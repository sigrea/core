# @sigrea/core

<p align="center">
  <img src="./images/sigrea_character_mendako.png" alt="Sigrea mascot" width="240" />
</p>

Sigrea extends [alien-signals](https://github.com/stackblitz/alien-signals) with Vue-inspired deep reactivity while adopting the framework-neutral spirit popularized by [Nano Stores](https://github.com/nanostores/nanostores). One package bundles atomic signals, proxy-backed state, and lifecycle-safe logic helpers, providing a single entry point.

- **Renderer-agnostic.** Scope APIs and logic factories keep domain code detached from React, Vue, or custom hosts while still supporting familiar hooks.
- **Deep reactivity.** `deepSignal` proxies nested objects, Maps, Sets, and typed arrays without extra decorators, and readonly or shallow variants share the same scheduler.
- **Consistent lifecycles.** `Scope`, `defineLogic`, `onMount`, and cleanup helpers mirror Vue’s effect scopes so cleanups still run even when tests fail.
- **Lightweight core.** Signals, watchers, and lifecycle utilities rely on alien-signals, so Sigrea provides focused helpers instead of re-implementing schedulers.
- **Testing-friendly ergonomics.** `mountLogic`, `cleanupLogic`, and `cleanupLogics` mirror host lifecycles without rendering layers, much like Nano Stores keeps stores outside components.

## Table of Contents

- [Install](#install)
- [Why Sigrea](#why-sigrea)
- [Quick Example](#quick-example)
- [Core Concepts](#core-concepts)
  - [Architecture](#architecture)
  - [Signals and Computed Values](#signals-and-computed-values)
  - [Deep Signals and Readonly Views](#deep-signals-and-readonly-views)
  - [Watching and Effects](#watching-and-effects)
  - [Scopes and Logic Lifecycles](#scopes-and-logic-lifecycles)
- [Testing](#testing)
- [Handling Scope Cleanup Errors](#handling-scope-cleanup-errors)
- [Development](#development)
- [License](#license)

## Install

```bash
npm install @sigrea/core
```

Requires Node.js 20 or later.

## Why Sigrea

Sigrea began as an experiment to bring Vue-style deep reactivity to the lightweight, framework-agnostic workflow inspired by Nanostores. alien-signals orchestrates dependency tracking and scheduling, while Sigrea contributes proxy handlers, scope helpers, and logic factories. This split keeps the core small but focused: signals remain mutable, computed values stay cached until invalidated, and every watcher shares one scheduler so flush modes stay predictable.

## Quick Example

**Basic Usage:**

```ts
import { signal, computed } from "@sigrea/core";

const count = signal(0);
const doubled = computed(() => count.value * 2);

count.value = 5;
console.log(doubled.value); // 10
```

**With Logic Factories:**

```ts
// logics/CounterLogic.ts
interface CounterProps {
  initialCount: number;
}

export const CounterLogic = defineLogic<CounterProps>()((props) => {
  const count = signal(props.initialCount);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value++;
  }

  function decrement() {
    count.value--;
  }

  watch(count, (newVal) => {
    console.log("count changed:", newVal);
  });

  onMount(() => console.log("CounterLogic mounted"));
  onUnmount(() => console.log("CounterLogic unmounted"));

  return {
    count: readonly(count),
    doubled,
    increment,
    decrement,
  };
});

// Usage
const counterLogic = mountLogic(CounterLogic, { initialCount: 0 });
counterLogic.increment();
console.log(counterLogic.count.value); // 1
```

**Composing Logic:**

```ts
// logics/SearchLogic.ts
export type Category = "all" | "kitchen" | "desk";

export const SearchLogic = defineLogic()(() => {
  const query = signal("");
  const category = signal<Category>("all");

  function setQuery(value: string) {
    query.value = value;
  }

  function setCategory(value: Category) {
    category.value = value;
  }

  return {
    query: readonly(query),
    category: readonly(category),
    setQuery,
    setCategory,
  };
});

// logics/ProductListLogic.ts
import { SearchLogic, type Category } from "./SearchLogic";

interface Product {
  id: string;
  name: string;
  category: Category;
}

export const ProductListLogic = defineLogic()((_, { get }) => {
  const searchLogic = get(SearchLogic);

  const products = deepSignal<Product[]>([
    { id: "1", name: "Coffee Mug", category: "kitchen" },
    { id: "2", name: "Laptop Stand", category: "desk" },
    { id: "3", name: "Desk Lamp", category: "desk" },
  ]);

  const filteredProducts = computed(() => {
    const query = searchLogic.query.value.toLowerCase();
    const selectedCategory = searchLogic.category.value;

    return products.filter((product) => {
      const matchesQuery = product.name.toLowerCase().includes(query);
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  });

  return {
    products: readonly(products),
    filteredProducts,
  };
});

// Usage
const searchLogic = mountLogic(SearchLogic);
const productListLogic = mountLogic(ProductListLogic);

searchLogic.setCategory("desk");
console.log(productListLogic.filteredProducts.value.length); // 2

searchLogic.setQuery("lamp");
console.log(productListLogic.filteredProducts.value.length); // 1
```

## Core Concepts

### Architecture

Sigrea layers alien-signals primitives, deep proxy handlers, and scope-aware lifecycles, allowing features to work directly with logic factories.

```
logic setup ──► scope ──► signals / deep signals ──► watch & watchEffect
                    │                                   │
                    └──────────── cleanup hooks ◄───────┘
```

### Signals and Computed Values

`signal(initial)` returns a mutable cell backed by alien-signals. `.value` reads and writes synchronously, and updates are queued for downstream watchers on the shared scheduler. `computed(fn)` memoizes derived values until any tracked signal invalidates them. Use `nextTick()` when you need to wait for queued watchers.

```ts
const count = signal(1);
const doubled = computed(() => count.value * 2);

count.value = 3;
console.log(doubled.value); // 6
```

### Deep Signals and Readonly Views

`deepSignal(value)` proxies objects, arrays, typed arrays, `Map`, `Set`, `WeakMap`, and `WeakSet`. Nested writes propagate to shallow and deep subscriptions, so watchers can decide how much work they perform. Stored signals are automatically unwrapped, keeping ergonomics close to Vue refs and Nanostores maps. Use `shallowDeepSignal()` when only top-level mutations should trigger updates, and wrap exposures in `readonly` or `readonlyShallowDeepSignal()` to pass them across logic boundaries without allowing writes.

```ts
const user = deepSignal({
  name: "Mendako",
  address: {
    city: "Tokyo",
    country: "Japan",
  },
});

user.address.city = "Kyoto"; // deep mutation notifies watchers

const publicUser = readonly(user);
console.log(publicUser.address.city); // "Kyoto"

publicUser.name = "Sora"; // throws in dev, noop in prod
```

### Watching and Effects

`watch(source, callback, options?)` accepts a single signal, a getter, or an array of sources. It passes `newValue`, `oldValue`, and an `onCleanup` helper so you can unregister resources on the next run. `watchEffect(effect, options?)` auto-tracks every signal accessed during the effect. Both share the scheduler with `signal` and `computed`, ensuring watchers for nested proxies never miss updates.

```ts
const settings = deepSignal({
  preferences: { theme: "light" },
  locale: { language: "ja", region: "JP" },
});

watch(
  () => settings.preferences.theme,
  (theme, oldTheme) => {
    console.log(`theme: ${oldTheme} → ${theme}`);
  },
  { immediate: true },
);

watchEffect(() => {
  console.log(`locale: ${settings.locale.language}-${settings.locale.region}`);
});

settings.preferences.theme = "dark";
settings.locale.language = "en";
settings.locale.region = "US";

// Output:
// "theme: undefined → light"
// "locale: ja-JP"
// "theme: light → dark"
// "locale: en-US"
```

### Scopes and Logic Lifecycles

Every logic factory owns a root `Scope`, and cleanup callbacks register automatically while it is active. `defineLogic` and `mountLogic` wrap this plumbing so you can mount instances, call `cleanupLogics()` in tests, and rely on consistent cleanup. `onMount` runs setup code when the logic mounts, while `onUnmount` registers cleanup callbacks to release intervals, sockets, or watchers when the logic unmounts.

```ts
export const TimerLogic = defineLogic()(() => {
  const count = signal(0);
  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    intervalId = setInterval(() => {
      count.value += 1;
    }, 1000);
  });

  onUnmount(() => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
    }
  });

  return {
    count: readonly(count),
  };
});

const timerLogic = mountLogic(TimerLogic);
timerLogic.count.value; // -> 0…1…2…
cleanupLogics(); // stops the interval
```

## Testing

```ts
// tests/CounterLogic.test.ts
import { CounterLogic } from "../logics/CounterLogic";

afterEach(() => cleanupLogics());

it("increments and exposes derived state", () => {
  const counterLogic = mountLogic(CounterLogic, { initialCount: 10 });

  counterLogic.increment();

  expect(counterLogic.count.value).toBe(11);
  expect(counterLogic.doubled.value).toBe(22);
});
```

## Handling Scope Cleanup Errors

When cleanup callbacks throw errors during scope disposal, Sigrea collects them into an `AggregateError`. Use `setScopeCleanupErrorHandler` to customize error handling and forward failures to monitoring services:

```ts
import { setScopeCleanupErrorHandler } from "@sigrea/core";

setScopeCleanupErrorHandler((error, context) => {
  console.error(`Cleanup failed:`, error);

  // Forward to monitoring service
  if (typeof Sentry !== "undefined") {
    Sentry.captureException(error, {
      tags: { scopeId: context.scopeId, phase: context.phase },
    });
  }
});
```

The handler receives `error` (the thrown exception) and `context` (scope metadata including `scopeId`, `phase`, `index`, and `total`). Return `ScopeCleanupErrorResponse.Suppress` to prevent the error from being thrown, or `Propagate` to rethrow immediately for synchronous errors.

## Development

Development scripts prefer pnpm. npm or yarn work too, but pnpm keeps dependency resolution identical to CI.

- `pnpm install` — install dependencies.
- `pnpm test` — run the Vitest suite once (no watch).
- `pnpm test:coverage` — collect V8 coverage for release gating.
- `pnpm build` — compile via unbuild to produce dual CJS/ESM bundles.
- `pnpm cicheck` — run tests, type-checks, and Biome formatting exactly like CI.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow details.

## License

MIT — see [LICENSE](./LICENSE).
