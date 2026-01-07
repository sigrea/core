/**
 * ==================================================
 * core
 * ==================================================
 */

// computed
export { computed, isComputed } from "./core/computed";
export type { Computed } from "./core/computed";

// deepSignal
export {
	deepSignal,
	readonlyDeepSignal,
	readonlyShallowDeepSignal,
	shallowDeepSignal,
	toRawDeepSignal,
	isDeepSignal,
} from "./core/deepSignal";
export type {
	DeepSignal,
	ReadonlyDeepSignal,
	ReadonlyShallowDeepSignal,
	ShallowDeepSignal,
} from "./core/deepSignal";

// readonly
export { readonly } from "./core/readonly";
export type { ReadonlySignal } from "./core/readonly";

// markRaw
export { markRaw, isRaw } from "./core/markRaw";

// scope
export {
	Scope,
	createScope,
	runWithScope,
	getCurrentScope,
	onDispose,
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

// reactivity helpers
export {
	isSignal,
	toValue,
	pauseTracking,
	resumeTracking,
	untracked,
} from "./core/reactivity";

/**
 * ==================================================
 * lifecycle
 * ==================================================
 */

// onMount
export { onMount } from "./molecule/lifecycle/onMount";

// onUnmount
export { onUnmount } from "./molecule/lifecycle/onUnmount";

/**
 * ==================================================
 * molecule
 * ==================================================
 */

// molecule
export { molecule } from "./molecule/molecule";
export { get } from "./molecule/get";
export type {
	MoleculeArgs,
	MoleculeFactory,
	MoleculeInstance,
	IsAllOptional,
} from "./molecule/types";

// handlers
export {
	createComputedHandler,
	createDeepSignalHandler,
	createSignalHandler,
} from "./molecule/handlers";
export type { Snapshot, SnapshotHandler } from "./molecule/handlers";

// instance
export { isMoleculeInstance } from "./molecule/instance";

// runtime API
export {
	disposeMolecule,
	mountMolecule,
	unmountMolecule,
} from "./molecule/internals";

// test utilities
export { trackMolecule, disposeTrackedMolecules } from "./molecule/testing";
