# Repository Guidelines

## Project Structure and Module Layout
The library exports from `index.ts`, and `pnpm build` emits dual ESM and CJS bundles under `dist/`. Core signal primitives live in `packages/core`, lifecycle orchestration in `packages/lifecycle`, reusable molecule helpers in `packages/molecule`, and shared fixtures under `packages/__tests__`. Images that illustrate behavior stay in `images/`, while generated artifacts such as `dist/` and `coverage/` must be kept out of commits by relying on the existing `.gitignore`.

## Build, Test, and Local Development
Install dependencies with `pnpm install` to match the locked Node 20 and pnpm 10 toolchain. `pnpm build` runs unbuild to compile TypeScript, `pnpm test` executes Vitest once in run mode, and `pnpm test:coverage` collects V8 instrumentation for release gating. Use `pnpm typecheck` for isolated `tsc` diagnostics, and call `pnpm cicheck` before large pushes to mimic CI by chaining tests, type checking, and formatting fixes. Run `pnpm format` (or `pnpm format:fix`) to apply Biome rules whenever code touches shared modules.

## Coding Style and Naming Conventions
All source files are authored as ES modules with two-space indentation. Runtime exports favor `camelCase`, types and classes use `PascalCase`, and molecule factories use the `molecule()` helper. Lifecycle utilities exposed publicly should mirror `onMount` and `onUnmount` naming so downstream adapters can grep for familiar hooks. Formatting deviations are considered lint failures, so run Biome scripts before committing to catch drift quickly.

## Testing Guidelines
Vitest backs both unit and integration coverage. Place cross-package suites in `packages/__tests__` with the `*.test.ts` suffix, and co-locate targeted specs beside the modules they validate as `*.spec.ts`. Reproduce runtime lifecycles by creating molecule instances directly (e.g., `const instance = MyMolecule()`), tracking them with `trackMolecule(instance)`, establishing scopes with `beforeAll` or `beforeEach`, and always calling `disposeTrackedMolecules()` in `afterEach` to avoid hidden subscriptions. Each feature addition should include at least one happy path and one failure path test plus coverage verification through `pnpm test:coverage`.

## Commit and Pull Request Workflow
Git history follows Conventional Commits, for example `feat: add scope watcher`, so use `<type>: <summary>` to keep changelog generation reliable. Pull requests should describe intent, highlight risky changes, and list the exact commands executed locally. Reference issues using `Closes #123` syntax, attach logs or snapshots when behavior changes, and never attach build outputs or `node_modules/`. When in doubt, cross-check CONTRIBUTING.md before opening the PR to confirm automation steps.
