# Batch Helpers Specification Delta

## ADDED Requirements

### Requirement: batching adjusts depth consistently
Batch helpers MUST mirror the legacy behaviour of incrementing depth and triggering effect flushes when exiting the outermost batch.
#### Scenario: When `startBatch()` is invoked
- Given the reactive-system batching utilities
- When `startBatch()` executes
- Then it must call `incrementBatchDepth()` exactly once
- And it must not flush effect notifications immediately
#### Scenario: When `endBatch()` unwinds nested batches
- Given a current batch depth greater than zero
- When `endBatch()` is called
- Then it must call `decrementBatchDepth()`
- And if the returned depth is zero it must call `processEffectNotifications()` to flush pending effects
- And if the returned depth is greater than zero it must skip flushing so inner batches can finish first
#### Scenario: When `endBatch()` is called without an active batch
- Given the current batch depth is `0`
- When `endBatch()` executes
- Then it must throw an error explaining that `startBatch()` must be called before `endBatch()`

### Requirement: batch helper balances start and end automatically
`batch` MUST provide a safe wrapper that balances `startBatch`/`endBatch` even when the wrapped function throws.
#### Scenario: When `batch(fn)` executes
- Given a synchronous function `fn`
- When `batch(fn)` is invoked
- Then it must call `startBatch()` before running `fn`
- And it must call `endBatch()` in a `finally` block so cleanup occurs even if `fn` throws
