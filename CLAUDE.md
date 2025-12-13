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
pnpm cicheck         # Run tests + typecheck + format (identical to CI)
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
    reactivity/        # track/trigger infrastructure and proxy handlers
      handlers/        # base, array, collection, readonly, shallow, mutable
    __tests__/
  lifecycle/           # onMount, onUnmount hooks
  molecule/             # molecule factory, mountMolecule, cleanupMolecules
  __tests__/           # Cross-package tests
  index.ts             # Single entry point
```

### How the Reactivity Layers Work

1. **alien-signals integration** (`packages/core/reactivity.ts`)
   - Obtains `link`, `unlink`, `propagate` via `createReactiveSystem()`
   - `Effect` class implements `ReactiveNode`, while `track()` and `trigger()` manage `targetMap: WeakMap<object, Map<key, Dep>>`
   - `Dep` is `SignalNode<number>` type representing dependencies on each property
   - `batch()` and `flush()` provide queue-driven scheduling

2. **Proxy handlers** (`packages/core/reactivity/handlers/`)
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
   - `registerScopeCleanup(fn)` for automatic cleanup registration

6. **Molecule factories** (`packages/molecule/molecule.ts`)
   - `molecule<TProps>((props) => { ... })` pattern
   - Each molecule instance owns its own Scope; during setup execution, `use(ChildMolecule, props)` retrieves and links child molecule
   - `mountMolecule()` / `useMolecule()` for mounting, `cleanupMolecule()` / `cleanupMolecules()` for post-test cleanup

### Design Principles

- **Delegation to alien-signals**: Low-level scheduling and dependency tracking are delegated to alien-signals; Sigrea focuses on proxy handlers, scope management, and molecule factories
- **Handler integration**: Integrates track/trigger calls into proxy handlers; deepSignal detects nested object and collection changes with fine granularity
- **Vue-style lifecycle**: `onMount`/`onUnmount` are implemented based on Scope, independent of host renderer
- **Single entry point**: `packages/index.ts` consolidates all exports, generating dual CJS/ESM bundles

## Coding Conventions

- **ES modules**: All `.ts` files with 2-space indentation, Biome applied
- **Naming**: Runtime uses camelCase, types/classes use PascalCase, molecule factories use `molecule()`
- **Lifecycle utilities**: Unify with `onMount`, `onUnmount` naming for searchability
- **Test placement**: Cross-package in `packages/__tests__/*.test.ts`, unit tests adjacent to modules as `*.spec.ts`
- **Cleanup**: Always set `afterEach(() => cleanupMolecules())` in tests

## Testing Guidelines

- Use `mountMolecule(MoleculeFactory, props)` to reproduce actual lifecycles
- Call `cleanupMolecules()` in `afterEach()` to reset hidden subscriptions
- Add happy path + failure path for each feature
- Verify coverage with `pnpm test:coverage`

## Commit Conventions

- **Conventional Commits**: `<type>: <summary>` format (e.g., `feat: add scope watcher`, `fix(deepSignal): unwrap nested signals`)
- **Changelog**: Changelogen reads commit history directly. Make sure user-facing work lands as `feat`, `fix`, etc., or clearly describe the impact in the PR body.

## Release Flow

- Maintainers run `pnpm release` locally, which executes tests, builds, bumps the version via Changelogen, and commits/tag the release (e.g., `chore(release): vX.Y.Z` plus `vX.Y.Z` tag).
- Push the commit and tag (`git push --follow-tags`). This triggers `.github/workflows/publish.yml` automatically or it can be re-run via `workflow_dispatch`.
- `publish` installs deps, runs tests/build, publishes to npm (with `--provenance`) and GitHub Packages, ensures the tag exists, and syncs GitHub Release notes via `pnpm dlx changelogen gh release vX.Y.Z --token $GITHUB_TOKEN`.

## Important Notes

- **Role of alien-signals**: Primitives like `SignalNode<T>`, `ReactiveNode`, `createReactiveSystem()` are provided by alien-signals
- **Proxy caching**: `deepSignal()` caches proxies in WeakMap to return the same proxy for the same object
- **ITERATE_KEY / MAP_KEY_ITERATE_KEY**: Internal Symbols for iteration tracking, used to detect for-loops over arrays/Map/Set
- **Scheduler integration**: track/trigger integrate with alien-signals' link/unlink, and Sigrea's flush() processes the effect queue
