# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Install dependencies:**
```bash
pnpm install
```

**Build:**
```bash
pnpm build           # Production build via unbuild
pnpm typecheck       # TypeScript type checking only
```

**Test:**
```bash
pnpm test            # Run Vitest once (no watch)
pnpm test:coverage   # Collect V8 coverage
```

**Format:**
```bash
pnpm format          # Check Biome formatting (no writes)
pnpm format:fix      # Apply Biome auto-fixes
```

**CI simulation:**
```bash
pnpm -s cicheck      # Run test, typecheck, build, smoke, and format checks
```

**Run a single test:**
```bash
pnpm test packages/core/__tests__/signal.test.ts
```

## Architecture Overview

Sigrea builds on alien-signals to provide Vue-style deep reactivity in a framework-agnostic manner.

### Package Structure

```
packages/
  core/                # Core primitives: signal, computed, watch, scope
    reactiveObject/    # Proxy-based deepSignal helpers (createReactiveObject + handlers)
      handlers/        # base, array, collection, readonly, shallow, mutable
    __tests__/
  molecule/             # molecule factory, disposeMolecule, trackMolecule, disposeTrackedMolecules
    lifecycle/         # onMount, onUnmount hooks (molecule mount/unmount lifecycle)
  __tests__/           # Cross-package tests
  index.ts             # Single entry point
```

### How the Reactivity Layers Work

1. **alien-signals integration** (`packages/core/reactivity.ts`)
   - Obtains `link`, `unlink`, `propagate` via `createReactiveSystem()`
   - `Effect` class implements `ReactiveNode`, while `track()` and `trigger()` manage `targetMap: WeakMap<object, Map<key, Dep>>`
   - `Dep` is `SignalNode<number>` type representing dependencies on each property
   - `batch()` and `flush()` provide queue-driven scheduling

2. **Proxy handlers** (`packages/core/reactiveObject/handlers/`)
   - `base.ts`: Base handler containing common `track()`/`trigger()` plumbing
   - `array.ts`: Intercepts array operations (push, pop, length, etc.) and adds INTEGER_KEY and length tracking
   - `collection.ts`: Intercepts Map, Set, WeakMap, WeakSet using dedicated `ITERATE_KEY`/`MAP_KEY_ITERATE_KEY`
   - `readonly.ts`, `shallow.ts`, `mutable.ts`: Customize readonly, shallow, and mutable behaviors respectively
   - Each handler is applied through `createReactiveObject(target, proxyMap, handlers)`

3. **deepSignal** (`packages/core/deepSignal.ts`)
   - Recursively wraps objects, Arrays, Map, Set, and typed arrays with proxies
   - Automatically unwraps signals stored inside (Vue ref style)
   - Provides `shallowDeepSignal()`, `readonlyDeepSignal()`, `readonlyShallowDeepSignal()` variants

4. **watch & watchEffect** (`packages/core/watch.ts`, `packages/core/watchEffect.ts`)
   - `watch(source, callback, options)`: Supports signal/getter/array sources, receives oldValue/newValue/onCleanup
   - `watchEffect(fn, options)`: Auto-tracking effect that automatically subscribes to accessed signals
   - Flush modes: Recognizes `"pre"`, `"post"`, `"sync"` and integrates with scheduler
   - Depth limit options (adjust granularity for detecting deep proxy changes)

5. **Scope lifecycle** (`packages/core/scope.ts`)
   - `Scope` class manages tree structure of cleanup callbacks
   - `createScope()`, `runWithScope()`, `disposeScope()` control effect and watcher lifecycles
   - `onDispose(fn)` for automatic cleanup registration

6. **Molecule factories** (`packages/molecule/molecule.ts`)
   - `molecule<TProps>((props) => { ... })` pattern
   - Each molecule instance owns its own Scope; during setup execution, `get(ChildMolecule, props)` retrieves and links child molecule
   - `disposeMolecule()` for cleanup, `trackMolecule()` / `disposeTrackedMolecules()` for test tracking

### Design Principles

- **Delegation to alien-signals**: Low-level scheduling and dependency tracking are delegated to alien-signals; Sigrea focuses on proxy handlers, scope management, and molecule factories
- **Handler integration**: Integrates track/trigger calls into proxy handlers; deepSignal detects nested object and collection changes with fine granularity
- **Vue-style lifecycle**: `onMount`/`onUnmount` are implemented as molecule mount/unmount hooks, independent of host renderer
- **Single entry point**: `packages/index.ts` consolidates all exports, generating dual CJS/ESM bundles

## Coding Conventions

- **ES modules**: All `.ts` files with 2-space indentation, Biome applied
- **Naming**: Runtime uses camelCase, types/classes use PascalCase, molecule factories use `molecule()`
- **Lifecycle utilities**: Unify with `onMount`, `onUnmount` naming for searchability
- **Test placement**: Cross-package in `packages/__tests__/*.test.ts`, unit tests adjacent to modules as `*.spec.ts`
- **Cleanup**: Always set `afterEach(() => disposeTrackedMolecules())` in tests

## Testing Guidelines

- Create molecule instances with `const instance = MyMolecule()` and track with `trackMolecule(instance)`
- Call `disposeTrackedMolecules()` in `afterEach()` to reset hidden subscriptions
- For non-tracked cleanup, use `disposeMolecule(instance)` directly
- Add happy path + failure path for each feature
- Verify coverage with `pnpm test:coverage`

## Commit Conventions

- **Conventional Commits**: `<type>: <summary>` format (e.g., `feat: add scope watcher`, `fix(deepSignal): unwrap nested signals`)
- **Changelog**: Changelogen reads commit history directly. Make sure user-facing work lands as `feat`, `fix`, etc., or clearly describe the impact in the PR body.

## Release Flow

- Maintainers run `SIGREA_RELEASE_VERSION=x.y.z mise run release_version` from a clean `main` branch. The task runs `pnpm -s cicheck`, updates the changelog, and creates the `chore(release): vX.Y.Z` commit plus annotated `vX.Y.Z` tag.
- Push the commit and tag with `mise run push_release`. This runs `git push origin main --follow-tags` and triggers `.github/workflows/publish.yml`.
- `publish` installs deps, runs `pnpm -s cicheck`, publishes to npm with OIDC trusted publishing, and syncs GitHub Release notes via `pnpm exec changelogen gh release`.

## Important Notes

- **Role of alien-signals**: Primitives like `SignalNode<T>`, `ReactiveNode`, `createReactiveSystem()` are provided by alien-signals
- **Proxy caching**: `deepSignal()` caches proxies in WeakMap to return the same proxy for the same object
- **ITERATE_KEY / MAP_KEY_ITERATE_KEY**: Internal Symbols for iteration tracking, used to detect for-loops over arrays/Map/Set
- **Scheduler integration**: track/trigger integrate with alien-signals' link/unlink, and Sigrea's flush() processes the effect queue
