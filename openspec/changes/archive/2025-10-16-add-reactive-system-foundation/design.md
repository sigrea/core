# Design Notes: Reactive System Foundation

## Architecture Overview
- Use `alien-signals.createReactiveSystem` and configure Sigrea-specific update handlers (`computed.update()` and `effect.notify()`).
- Re-export helpers such as `propagate` and `startTracking` from the created `reactiveSystem` so upper layers can depend on them.

## Dependency Tracking Extension
- After `endTracking` completes, compare previous and current dependency sets. Call `_untrackSubscriber(sub)` on any dependency that was removed.
- Maintain tracked dependencies in a `WeakMap<Subscriber, Set<Dependency>>`; remove entries when no dependencies remain to defer cleanup work efficiently.

## Active Subscriber Management
- Keep a module-local `activeSub` reference and expose `setActiveSub` / `getActiveSub`. Signal/Computed/Effect retrieval relies on this to link dependencies automatically.

## Batch Depth
- Maintain a module-local counter and expose `incrementBatchDepth`, `decrementBatchDepth`, and `getBatchDepth`, which higher layers call from `startBatch` / `endBatch`.

## Testing Strategy
- Provide mock `Dependency` / `Subscriber` instances and verify `_untrackSubscriber` is invoked after `link` → `endTracking`.
- Test that batch depth helpers increment/decrement correctly and that active subscriber getters/setters behave as expected.
