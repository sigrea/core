# Readonly Store Specification Delta

## ADDED Requirements

### Requirement: readonly preserves signal lifecycle while blocking writes
The `readonly` helper MUST return a view that mirrors the source signal’s value and lifecycle contracts without allowing mutations.
#### Scenario: When `readonly(signal)` is called
- Given a valid `Signal` instance
- When `readonly(signal)` executes
- Then it must return an object whose `value` getter proxies the source’s `value`
- And assignments to `value` must throw a `TypeError`
- And lifecycle methods (`onMount`, `_listenerCount`, `_isMounted`) must delegate to the source signal
- And passing a non-signal must throw a `TypeError`
