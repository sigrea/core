# Signal Store Specification Delta

## ADDED Requirements

### Requirement: signal reads link the active subscriber
Signals MUST register the currently evaluating subscriber and track new listeners for lifecycle management.
#### Scenario: When a subscriber reads `signal.value`
- Given an active subscriber is set via `setActiveSub`
- And the subscriber has not previously been tracked by the signal
- When `signal.value` is accessed
- Then the signal must call `link(signal, subscriber)`
- And it must record the subscriber so `_trackedSubscribers` increments `_listenerCount`
- And it must cancel any pending unmount timer when the count becomes non-zero

### Requirement: signal writes propagate change notifications
Setting a signal’s value MUST notify dependencies and flush effect notifications outside of batches.
#### Scenario: When assigning a new value
- Given a signal with at least one subscriber link
- And the new value is not strictly equal to the current value
- When `signal.value = nextValue`
- Then the signal must call `propagate(subs)` on its head link
- And if `getBatchDepth()` returns `0` it must call `processEffectNotifications()`
#### Scenario: When assigning the same value
- Given a signal with any number of subscriber links
- And the new value is strictly equal to the current value
- When `signal.value = currentValue`
- Then the signal must leave the stored value unchanged
- And it must skip calling `propagate` or `processEffectNotifications()`

### Requirement: signal lifecycle honours mount/unmount semantics
Signals MUST expose on-mount and delayed unmount behaviour compatible with the legacy implementation.
#### Scenario: When the first subscriber is tracked
- Given a signal whose `_listenerCount` is `0`
- When a subscriber is linked for the first time
- Then the signal must mark itself mounted and invoke all registered mount callbacks
- And cleanup functions returned by callbacks must be stored
#### Scenario: When the last subscriber is removed
- Given a mounted signal with `_listenerCount` equal to `1`
- When `_untrackSubscriber` removes that listener
- Then the signal must schedule `_unmount()` after roughly 1 second
- And if no new subscribers arrive before the timer fires, it must call pending cleanup functions and mark `_isMounted = false`
#### Scenario: When an `onMount` disposer runs while mounted
- Given a mounted signal with a registered `onMount` callback that returned a cleanup
- When the disposer returned by `onMount` is invoked
- Then the signal must remove that callback and its cleanup so the cleanup is not executed during a later unmount
#### Scenario: When `onMount` receives an invalid callback
- Given a signal instance
- When `onMount(signal, nonFunction)` is invoked with a value that is not a function
- Then it must throw a `TypeError` explaining the callback requirement
