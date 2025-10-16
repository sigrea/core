1. - [x] Implement the `alien-signals` wrapper in `packages/reactive-system/core` and expose APIs such as `propagate`.
2. - [x] Extend dependency tracking in `packages/reactive-system/tracking` and ensure `_untrackSubscriber` runs when dependencies are removed.
3. - [x] Add `activeSub` and `batch` modules so we can manage the active subscriber and batch depth.
4. - [x] Wire up the barrel exports in `packages/reactive-system/index.ts` and the repository entry points.
5. - [x] Add minimal unit tests for the APIs above and verify they pass with `pnpm test -- packages/reactive-system` (or equivalent).
6. - [x] Re-run `openspec validate add-reactive-system-foundation --strict` to finalize the specs and tasks.
