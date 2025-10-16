# Proposal: Re-implement Reactive System Foundation

## Background
- The deprecated repository (`core_deprecated`) already implemented a reactive system on top of `alien-signals`.
- The new repository currently contains configuration only; the runtime implementation is empty. To publish the library as OSS we must rebuild the minimal reactive foundation.
- All upcoming features (Signal, Computed, Effect, etc.) assume this layer exists.

## Goal
- Rebuild the minimal core features (`core`, `tracking`, `activeSub`, `batch`) within `packages/reactive-system`, matching the previous implementation.
- Extend `alien-signals` behavior for Sigrea to provide lifecycle cleanup via `_untrackSubscriber` and batching control helpers.

## Scope
- Wrapper implementation and exports in `packages/reactive-system/core`.
- Dependency tracking extensions (`tracking/`) and active subscriber management (`activeSub/`).
- Batch depth helpers (`batch/`).
- Barrel exports (`packages/reactive-system/index.ts`, `packages/index.ts`, and root `index.ts`).
- Minimal unit tests that verify the public `reactive-system` API contract.

## Out of Scope
- Higher-level APIs such as Signal / Computed / Effect (handled in future branches).
- Broad documentation updates (covered during final integration work).

## Deliverables
- TypeScript implementation under `packages/reactive-system`.
- Minimal test coverage for this package.
- Export wiring that exposes the new APIs.

## Risks / Concerns
- `_untrackSubscriber` hooks are tightly coupled to upper layers, making them harder to test. We rely on subscriber mocks for minimal verification.
- When migrating from the old implementation, avoid importing unnecessary complexity—port only what the API contract requires.

## Next Steps After Approval
- Proceed to the `core-stores` change that implements Signal/Computed/Effect on top of this foundation.
