# Lifecycle Helpers Specification Delta

## ADDED Requirements

### Requirement: lifecycle helpers delegate to signal/computed implementations
`onMount`, `onUnmount`, and `keepMount` MUST accept either a `Signal` or `Computed` and forward to the corresponding store helpers with type validation.
#### Scenario: When calling lifecycle helper with a signal
- Given a signal instance and a lifecycle callback
- When `onMount(signal, callback)` is invoked
- Then it must return the result of `signal.onMount(callback)`
- And `onUnmount` and `keepMount` must perform the same delegation
#### Scenario: When calling lifecycle helper with a computed
- Given a computed instance and a lifecycle callback
- When `onMount(computed, callback)` is invoked
- Then it must return the result of `computed.onMount(callback)`
- And `onUnmount` and `keepMount` must perform the same delegation
#### Scenario: When calling lifecycle helper with a non-store
- Given a plain object that is neither a signal nor computed
- When any lifecycle helper is invoked with the object
- Then the helper must throw a `TypeError` explaining that only signals or computed stores are supported
