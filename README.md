# @sigrea/core

<p align="center">
  <img src="./images/sigrea_character_mendako.png" alt="Sigrea mascot" width="240" />
</p>

Sigrea is a small reactive core built on [alien-signals](https://github.com/stackblitz/alien-signals).
It adds Vue-inspired deep reactivity and scope-based lifecycles.
It provides core primitives to build hooks, plus optional lifecycles for ownership and cleanup.

- **Core primitives.** `signal`, `computed`, `deepSignal`, `watch`, and `watchEffect`.
- **Lifecycles.** `Scope`, `onMount`, and `onUnmount` for cleanup boundaries.
- **Molecules.** `molecule()` is a UI-less lifecycle container (not "all your logic").
- **Composition.** Build molecule trees via `use()`.
- **Testing.** `trackMolecule` + `cleanupTrackedMolecules` helps reproduce lifecycles in tests.

## Table of Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [Hooks](#hooks)
- [Molecules](#molecules)
- [Testing](#testing)
- [Handling Scope Cleanup Errors](#handling-scope-cleanup-errors)
- [Development](#development)
- [License](#license)

## Install

```bash
npm install @sigrea/core
```

## Quick Start

### Signals and Computed

```ts
import { computed, signal } from "@sigrea/core";

const count = signal(1);
const doubled = computed(() => count.value * 2);

count.value = 3;
console.log(doubled.value); // 6
```

## Hooks

Hooks are plain functions built from the core primitives.
This package does not include UI bindings.
In UI apps, you usually call hooks inside a molecule.
Then connect the molecule to the UI layer via an adapter.

### Example: state + actions

```ts
import { computed, readonly, signal } from "@sigrea/core";

export function useCounter(initial = 0) {
  const count = signal(initial);
  const doubled = computed(() => count.value * 2);

  const increment = () => {
    count.value++;
  };

  const decrement = () => {
    count.value--;
  };

  return {
    count: readonly(count),
    doubled,
    increment,
    decrement,
  };
}
```

### Example: deepSignal for nested state

```ts
import { computed, deepSignal } from "@sigrea/core";

export function useUserProfile() {
  const profile = deepSignal({
    name: "Mendako",
    address: { city: "Tokyo" },
  });

  const label = computed(() => {
    return `${profile.name} @ ${profile.address.city}`;
  });

  const setCity = (city: string) => {
    profile.address.city = city;
  };

  return {
    profile,
    label,
    setCity,
  };
}
```

## Molecules

`molecule(setup)` creates a function.
Calling it creates a new instance with its own root `Scope`.
It does not render anything.
Use molecules when you need:

- a clear ownership + cleanup boundary (`Scope`, `onUnmount`),
- parent-child relationships between lifecycled units (`use()`),
- per-instance configuration via props.

Inside `setup`, you can call hooks or use the core primitives directly.
Child molecules are internal dependencies—prefer returning only the outputs
(signals, computed values, actions) that consumers need.

### Creating a molecule

```ts
import { molecule, onUnmount, readonly, signal } from "@sigrea/core";

interface IntervalMoleculeProps {
  intervalMs: number;
}

const IntervalMolecule = molecule<IntervalMoleculeProps>((props) => {
  const tick = signal(0);

  const id = setInterval(() => {
    tick.value += 1;
  }, props.intervalMs);

  onUnmount(() => clearInterval(id));

  return {
    tick: readonly(tick),
  };
});
```

### Composing molecules with `use()`

```ts
import { molecule, readonly, signal, use, watch } from "@sigrea/core";

interface DraftSessionMoleculeProps {
  intervalMs: number;
  initialText: string;
  save: (text: string) => void;
}

export const DraftSessionMolecule = molecule<DraftSessionMoleculeProps>(
  (props) => {
    const text = signal(props.initialText);
    const isDirty = signal(false);

    const setText = (next: string) => {
      text.value = next;
      isDirty.value = true;
    };

    const save = () => {
      props.save(text.value);
      isDirty.value = false;
    };

    const interval = use(IntervalMolecule, {
      intervalMs: props.intervalMs,
    });

    watch(interval.tick, () => {
      if (!isDirty.value) {
        return;
      }
      save();
    });

    return {
      isDirty: readonly(isDirty),
      setText,
      save,
      text: readonly(text),
    };
  },
);
```

Notes:

- `use()` must be called synchronously during molecule setup.
- `onUnmount()` callbacks and `watch()` effects are tied to the molecule scope.
- Child molecules created via `use()` are disposed with their parent.

## Testing

```ts
// tests/CounterMolecule.test.ts
import { afterEach, expect, it } from "vitest";

import {
  cleanupTrackedMolecules,
  molecule,
  readonly,
  signal,
  trackMolecule,
} from "@sigrea/core";

afterEach(() => cleanupTrackedMolecules());

it("increments and exposes derived state", () => {
  const CounterMolecule = molecule(() => {
    const count = signal(10);

    const increment = () => {
      count.value++;
    };

    return {
      count: readonly(count),
      increment,
    };
  });

  const counter = CounterMolecule();
  trackMolecule(counter);
  counter.increment();

  expect(counter.count.value).toBe(11);
});
```

## Handling Scope Cleanup Errors

Cleanup callbacks run when a scope is disposed.
If a cleanup throws, Sigrea collects errors into an `AggregateError`.

Use `setScopeCleanupErrorHandler` to customize error handling.
This is useful for logging or reporting to monitoring services.

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

The handler receives `error` and `context`.
`context` includes `scopeId`, `phase`, `index`, and `total`.

Return `ScopeCleanupErrorResponse.Suppress` to prevent the error from being thrown.
Return `ScopeCleanupErrorResponse.Propagate` to rethrow immediately for synchronous errors.

## Development

- `pnpm install` — install dependencies.
- `pnpm test` — run tests.
- `pnpm typecheck` — run TypeScript type checking.
- `pnpm test:coverage` — collect coverage.
- `pnpm build` — build the package.
- `pnpm cicheck` — run CI checks locally.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow details.

## License

MIT — see [LICENSE](./LICENSE).
