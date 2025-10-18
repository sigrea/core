# Computed Store Specification Delta

## ADDED Requirements

### Requirement: computed values lazily evaluate and cache
Computed stores MUST evaluate via the getter only when dirty or pending and cache the latest value.
#### Scenario: When `computed.value` is accessed while dirty
- Given a computed with `flags` including `Dirty`
- When `computed.value` is read
- Then it must call `processComputedUpdate(computed, flags)`
- And it must return the cached `_value` after evaluation

### Requirement: computed tracking wraps getter execution
Getter execution MUST run with the computed set as the active subscriber and gather dependencies restored afterwards.
#### Scenario: When `computed.update()` executes
- Given a computed with dependencies
- When `computed.update()` is invoked
- Then it must call `setActiveSub(this)` before invoking the getter
- And it must call `startTracking(this)` before the getter
- And it must restore the previous active subscriber and call `endTracking(this)` in a `finally` block
- And it must return `true` when the cached value changes

### Requirement: computed lifecycle mirrors signal semantics
Lifecycle callbacks MUST mount on the first listener and schedule delayed cleanup when listeners drop to zero.
#### Scenario: When `_untrackSubscriber` removes the final listener
- Given a mounted computed with `_listenerCount` equal to `1`
- When `_untrackSubscriber` removes that listener
- Then the computed must schedule `_unmount()` with a 1,000 ms delay and capture dependencies for later cleanup
- And when the timer fires with no new listeners it must call `_untrackSubscriber(this)` on previously captured dependencies and run stored cleanup callbacks
#### Scenario: When dependencies change before the delayed unmount fires
- Given a computed that has scheduled `_unmount()` because `_listenerCount` fell to `0`
- And the computed’s getter re-runs and starts tracking a different set of signal dependencies before the timer fires
- When `_unmount()` executes after the delay
- Then the computed must refresh the captured dependency set so `_untrackSubscriber(this)` is called on the new dependencies
- And cleanup callbacks registered on those dependencies must run as expected
#### Scenario: When an `onMount` disposer runs while mounted
- Given a mounted computed with a registered `onMount` callback that returned a cleanup
- When the disposer returned by `onMount` is invoked
- Then the computed must remove that callback and its cleanup so the cleanup is not executed during a later unmount
#### Scenario: When `onMount` receives a non-function callback
- Given a computed instance
- When `onMount(computed, nonFunction)` is invoked with a value that is not a function
- Then it must throw a `TypeError` describing the callback requirement
