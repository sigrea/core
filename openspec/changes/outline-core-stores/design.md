# Design Notes

## Legacy Behaviour Reference
- `signal` and `computed` act as both dependencies and lifecycle-capable stores. They keep track of subscriber counts, delay unmount by 1 s, and trigger cleanup callbacks.
- `computed` instances run lazily, pulling updates through `processComputedUpdate` and maintaining captured dependency sets for deferred cleanup.
- `effect` executes immediately and re-runs when flagged dirty. Calling `stop()` schedules reactive-system cleanup via a dedicated tracking cycle.
- `batch` provides `startBatch`/`endBatch` wrappers that adjust batch depth and defer effect notifications until depth returns to zero.
- `readonly` exposes the same lifecycle surface as `Signal` while preventing writes, implemented as a thin delegating subclass.
- Lifecycle helpers (`onMount`, `onUnmount`, `keepMount`) delegate to the underlying store while enforcing type guards.

## Key Interactions
- Every store relies on the reactive-system façade created in the previous change: `link`, `startTracking`, `endTracking`, batching helpers, and `SubscriberFlags`.
- Lifecycle callbacks must interoperate with the reactive-system `_untrackSubscriber` hook; failing to call it leaks subscriptions.
- Mount/unmount policies must remain consistent so downstream abstractions (e.g., `asyncComputed`, `logic`) can assume identical semantics.

## Planned Adjustments
- Keep the 1 s unmount grace period but document it as a requirement so alternative timers (such as manual cleanup) remain compliant.
- Surface read-only views through a dedicated helper rather than a new dependency node to avoid redundant graph edges.
- Ensure new TypeScript typedefs mirror the legacy public API to minimise migration work for consumers.
- Keep batching helpers thin and idempotent so consumers can compose nested batches without additional guards.

## Lifecycle Guidelines
- Treat `alien-signals` as the source of truth for dependency linking, subscriber flags, and notification ordering. Sigrea only layers lifecycle metadata on top of the bridge helpers.
- Provide framework-agnostic lifecycle helpers (`onMount`, `onUnmount`, `keepMount`) so downstream packages can consume them without UI integration details.
- Preserve deterministic error handling: swallow and log exceptions thrown from user callbacks to keep the reactive graph healthy even when cleanup fails.

### Grace Period Contract
- Signals and computed stores must mount on the first subscriber, schedule unmount one second after the last subscriber leaves, and cancel the timer when a new subscriber arrives during the grace period.
- `_listenerCount` is the authoritative field for mount state; any auxiliary bookkeeping such as tracked subscriber sets or cleanup stacks must stay consistent with its value.

### Dependency Refresh While Unmount Is Pending
- When `_listenerCount` drops to zero for a computed store, mark the instance as “unmount scheduled” and snapshot current dependencies.
- If the getter re-runs before the delayed unmount fires (for example, a manual read switches from `signalA` to `signalB`), refresh the captured dependency set immediately after tracking completes so `_untrackSubscriber` runs on the updated links.
- Clearing the unmount timer because a new subscriber arrived must also clear the captured dependency set and the scheduled flag.

### Cleanup Expectations
- `_untrackSubscriber` must remain idempotent because computed stores can call it both during dependency diffing and during unmount.
- When a computed unmounts and detaches from a signal, that signal’s own lifecycle handling should execute, ensuring `onUnmount` callbacks fire even if dependencies changed seconds earlier.
- After unmount, reset lifecycle state (`_capturedDependencies`, `_isUnmountScheduled`, `_activeMountCleanups`) so the next mount behaves like a fresh instance.

### Testing Guidance
- Use fake timers to verify grace-period behaviour (subscribe → unsubscribe → advance timers → assert cleanup).
- Add regression tests where dependencies change after scheduling unmount to prove new subscribers detach correctly.
- Keep test runs focused (`vitest run packages/computed/index.test.ts`) to iterate quickly on reactive primitives.

## Error & Batch Safety Hardening
- Mount callbacks now follow a strict insertion order and continue executing even when an earlier callback throws; failures are logged but must not block later callbacks.
- Remounting a signal or computed replaces the prior cleanup so unmount only runs the cleanup returned for that mount cycle.
- Computed getters and effect bodies restore the previously active subscriber even when an exception is thrown, allowing subsequent tracking passes to start from a clean slate.
- `decrementBatchDepth()` guards against underflow so auxiliary tooling cannot drive the reactive system into an invalid state, and `batch(fn)` always unwinds flushing notifications even if `fn` throws.
- Readonly views mirror lifecycle semantics across mount/unmount boundaries, ensuring the source signal handles cleanups exactly once per detachment.

### Test Coverage Commitments
- Signal and computed lifecycle suites now assert multi-callback ordering, remount cleanup replacement, and multi-subscriber teardown.
- Lifecycle helper tests cover positive delegation paths for both `Signal` and `Computed`, validating `keepMount` semantics alongside error handling.
- Batch and reactive-system tests exercise exception paths, dependency replacement, and idempotent re-linking to detect regressions early.

## Test Philosophy (Three-Principle Discipline)
- **Specify Behaviour**: Each `vitest` case documents a concrete requirement scenario (e.g., mount order preservation, dependency unsubscription) so failures point directly to the violated behaviour.
- **Close Feedback Loop**: Tests trigger the same public APIs that end-users call (`signal`, `computed`, `effect`, `batch`, lifecycle helpers) instead of private internals, ensuring regressions reflect real usage paths. Internal counters like `_listenerCount` are asserted only where the requirement itself exposes them as observable state.
- **Detect Regression**: Edge cases focus on multi-subscriber coordination, exception safety, and timer-driven cleanup to guard against historically fragile areas. New tests must justify their value by covering previously untested branches or guarding known failure patterns to avoid redundant coverage.
