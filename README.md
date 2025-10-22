# @sigrea/core

`@sigrea/core` wraps [alien-signals](https://github.com/stackblitz/alien-signals) and [alien-deepsignals](https://github.com/CCherry07/alien-deepsignals) so that shallow signals, deep reactive objects, scope-aware effects, and lifecycle helpers live behind a single, predictable API.

Sigrea keeps alien-signals as the scheduling engine, layers deep reactivity through alien-deepsignals, and adds high-level tooling (`defineLogic`, `onMount`, `mountLogic`, etc.) so domain logic can stay framework-agnostic while adapters connect it to React, Vue, or other runtimes.

## Installation

```bash
pnpm add @sigrea/core
```

Sigrea targets Node.js 20+ and pnpm 10+. Equivalent npm or yarn commands work as expected.

## What Sigrea Provides

- **Shared primitives** – `signal`, `computed`, `deepSignal`, `watch`, and `watchEffect` are powered by alien-signals while honoring Sigrea’s scope semantics.
- **Lifecycle scaffolding** – `defineLogic`, `onMount`, and `onUnmount` let you describe setup/cleanup once and reuse it across adapters and tests.
- **Testing helpers** – `mountLogic`, `cleanupLogic`, and `cleanupLogics` let you exercise logic modules without a UI runtime.
- **Adapter-friendly contracts** – higher-level packages can receive logic factories and manage lifecycles on your behalf.

## Quick Start

### Basic API

```ts
import { defineLogic, signal } from "@sigrea/core";

interface CounterProps {
  initialCount: number;
}

export const CounterLogic = defineLogic<CounterProps>()((props) => {
  const count = signal(props.initialCount);

  const increment = () => {
    count.value += 1;
  };

  const reset = () => {
    count.value = props.initialCount;
  };

  return {
    count,
    increment,
    reset,
  };
});
```

### Lifecycle helpers

```ts
import { defineLogic, onMount, onUnmount, signal } from "@sigrea/core";

export const SessionLogic = defineLogic()(() => {
  const status = signal<"idle" | "active">("idle");

  onMount(() => {
    status.value = "active";
  });

  onUnmount(() => {
    status.value = "idle";
  });

  return { status };
});
```

### Compose logic

```ts
import { defineLogic, signal } from "@sigrea/core";

interface ChildProps {
  label: string;
}

export const ChildLogic = defineLogic<ChildProps>()((props) => {
  const message = signal(`child: ${props.label}`);
  return { message };
});

interface ParentProps {
  childLabel: string;
}

export const ParentLogic = defineLogic<ParentProps>()((props, { get }) => {
  const child = get(ChildLogic, { label: props.childLabel });
  const header = signal("parent");

  return {
    child,
    header,
  };
});
```

### Test helpers

```ts
import { afterEach, expect, it } from "vitest";
import { cleanupLogics, mountLogic } from "@sigrea/core";
import { CounterLogic } from "./CounterLogic";

afterEach(() => {
  cleanupLogics();
});

it("increments", () => {
  const counter = mountLogic(CounterLogic, { initialCount: 0 });
  counter.increment();
  expect(counter.count.value).toBe(1);
});
```

### Watch reactive sources

```ts
import { signal, watch, watchEffect } from "@sigrea/core";

const count = signal(0);

const stop = watch(
  count,
  (value, previous) => {
    console.log("count changed", { value, previous });
  },
  { immediate: true },
);

const stopEffect = watchEffect(() => {
  console.log(count.value);
});

stop();
stopEffect();
```

Both `watch` and `watchEffect` register their cleanup with the active Sigrea scope
(for example inside `onMount` or a `defineLogic` setup). When that scope disposes,
each reactive watcher is stopped automatically. If no scope is active, call the
`stop` handle manually as shown above.

## API Notes

- `defineLogic` returns a factory that can be curried with props. Adapters and test helpers accept the factory followed by props (`mountLogic(CounterLogic, props)`).
- `signal`, `computed`, `deepSignal`, `watch`, and `watchEffect` mirror their alien-signals counterparts but honor Sigrea scopes so cleanups are automatic.
- `onMount` nests scopes, allowing each logic instance to register timers, effects, or subscriptions that are disposed via `onUnmount`.
- `mountLogic`, `cleanupLogic`, and `cleanupLogics` mirror adapter behavior, making unit tests predictable.

### defineLogic props quick reference

- `defineLogic()` → no props; call the returned factory as `logic()`.
- `defineLogic<Props>()` → props are required unless every key in `Props` is optional.
- Optional props allow calling `logic()` or `logic({ ... })`; required props must be passed explicitly.

## Scope Cleanup Error Handling

- Sigrea aggregates cleanup failures and rethrows them as an `AggregateError` when a scope disposes or when a cleanup is registered after disposal.
- `setScopeCleanupErrorHandler` installs a process-wide hook. Use it sparingly, and reset the handler once you are done so other code paths are not affected.

## Development

- `pnpm install` – install dependencies
- `pnpm test` – run the Vitest suite
- `pnpm build` – emit production artifacts
- See `CONTRIBUTING.md` and OpenSpec guidelines for contribution workflows

## License

MIT — see `LICENSE`.
