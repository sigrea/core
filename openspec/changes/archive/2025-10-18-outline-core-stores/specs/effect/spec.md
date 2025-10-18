# Effect Store Specification Delta

## ADDED Requirements

### Requirement: effect executes immediately and re-runs when dirty
Effects MUST run upon creation and re-run when notified with dirty flags matching legacy semantics.
#### Scenario: When `effect(fn)` is called
- Given an effect constructor wrapper
- When `effect(fn)` is invoked
- Then it must instantiate `new Effect(fn)`
- And it must call `run()` once before returning the instance
#### Scenario: When `Effect.notify()` runs with dirty flags
- Given an `Effect` whose `flags` include `Dirty`
- When `notify()` executes
- Then it must call `run()` to re-evaluate the effect function
- And when `flags` only include `PendingComputed` it must call `updateDirtyFlag(this, flags)` and re-run only if that returns `true`

### Requirement: effect tracking mirrors reactive-system protocol
Effect execution MUST manage active subscriber context and dependency tracking, and stopping must unsubscribe from dependencies.
#### Scenario: When `Effect.run()` executes
- Given an effect instance
- When `run()` is called
- Then it must store the previous active subscriber
- And it must call `setActiveSub(this)`, `startTracking(this)` before invoking `fn`
- And it must restore the previous subscriber and call `endTracking(this)` in a `finally` block
#### Scenario: When `Effect.stop()` is invoked
- Given an effect with dependencies
- When `stop()` is called
- Then it must iterate current dependency links and invoke each dependency’s `_untrackSubscriber(this)` when available so lifecycle cleanup happens immediately
- And it must call `startTracking(this)` followed immediately by `endTracking(this)` to clear links so the reactive-system wrapper untracks removed dependencies
