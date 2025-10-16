## ADDED Requirements

### Requirement: reactive-system exposes alien-signals bridge
The reactive-system core MUST delegate scheduling to the computed/effect instances created by Sigrea stores.
#### Scenario: When the library initializes the reactive system core
- Given the package `packages/reactive-system/core`
- When the module loads
- Then it must call `createReactiveSystem` from `alien-signals`
- And it must pass handlers that invoke `computed.update()` and `effect.notify()`
- And it must re-export `propagate`, `startTracking`, `updateDirtyFlag`, `processComputedUpdate`, and `processEffectNotifications`

### Requirement: reactive-system tracks dependency removals
Tracking wrappers MUST notify dependencies when subscribers stop depending on them.
#### Scenario: When a subscriber no longer depends on a dependency after tracking ends
- Given the function `endTracking(subscriber)` from `packages/reactive-system/tracking`
- And the subscriber accessed a dependency that implements `_untrackSubscriber`
- When `endTracking` detects that the dependency is no longer linked
- Then it must call `dependency._untrackSubscriber(subscriber)` exactly once

### Requirement: reactive-system manages active subscribers
Consumers MUST be able to set and read the currently evaluating subscriber.
#### Scenario: When setter is called before dependency access
- Given the functions `setActiveSub` and `getActiveSub`
- When `setActiveSub(subscriber)` is invoked
- And a dependency reads `getActiveSub()`
- Then it must receive the same subscriber reference
- And `setActiveSub(undefined)` must clear the reference

### Requirement: reactive-system exposes batch depth helpers
Batch helpers MUST maintain nested depth and disclose the current value.
#### Scenario: When batch depth is incremented and decremented
- Given `incrementBatchDepth`, `decrementBatchDepth`, and `getBatchDepth`
- When `incrementBatchDepth` is called twice
- Then `getBatchDepth()` must return `2`
- When `decrementBatchDepth` is called once
- Then `getBatchDepth()` must return `1`
- And when `decrementBatchDepth` removes the final level it must return `0`

### Requirement: reactive-system index re-exports public API
The barrel MUST re-export the core types and helpers so consumers have a single import path.
#### Scenario: When consuming `packages/reactive-system`
- Given the barrel file `packages/reactive-system/index.ts`
- When a consumer imports from this path
- Then it must expose the types `Dependency`, `Link`, `Subscriber`
- And it must expose the enum `SubscriberFlags`
- And it must expose the functions from core, tracking, activeSub, and batch modules
