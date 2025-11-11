/**
 * ==================================================
 * core
 * ==================================================
 */

// computed
export { computed } from "./core/computed";
export type { Computed } from "./core/computed";

// deepSignal
export { deepSignal } from "./core/deepSignal";
export type { DeepSignal } from "./core/deepSignal";

// readonly
export { readonly } from "./core/readonly";
export type { ReadonlySignal } from "./core/readonly";

// scope
export {
	Scope,
	createScope,
	runWithScope,
	getCurrentScope,
	registerScopeCleanup,
	disposeScope,
	setScopeCleanupErrorHandler,
	ScopeCleanupErrorResponse,
} from "./core/scope";
export type {
	Cleanup,
	ScopeCleanupErrorHandler,
	ScopeCleanupErrorContext,
	ScopeCleanupPhase,
} from "./core/scope";

// signal
export { signal } from "./core/signal";
export type { Signal } from "./core/signal";

// watch
export { watch } from "./core/watch";
export type {
	WatchStopHandle,
	WatchOptions,
	WatchCallback,
	WatchSource,
} from "./core/watch";

// watchEffect
export { watchEffect } from "./core/watchEffect";
export type { WatchEffect } from "./core/watchEffect";

// nextTick
export { nextTick } from "./core/nextTick";

/**
 * ==================================================
 * lifecycle
 * ==================================================
 */

// onMount
export { onMount } from "./lifecycle/onMount";
export type { MountOptions } from "./lifecycle/onMount";

// onUnmount
export { onUnmount } from "./lifecycle/onUnmount";

/**
 * ==================================================
 * logic
 * ==================================================
 */

// defineLogic
export { defineLogic } from "./logic/defineLogic";
export type {
	LogicArgs,
	LogicContext,
	LogicFunction,
	LogicInstance,
	IsAllOptional,
} from "./logic/types";

// handlers
export {
	createComputedHandler,
	createDeepSignalHandler,
	createSignalHandler,
} from "./logic/handlers";
export type { Snapshot, SnapshotHandler } from "./logic/handlers";

// instance
export { isLogicInstance } from "./logic/instance";

// testing utilities
export { cleanupLogic, cleanupLogics, mountLogic } from "./logic/testing";
