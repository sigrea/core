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
export { onMount } from "./lifecycle/onMount";
export type { MountOptions } from "./lifecycle/onMount";

// onUnmount
export { onUnmount } from "./lifecycle/onUnmount";

/**
 * ==================================================
 * molecule
 * ==================================================
 */

// molecule
export { molecule } from "./molecule/molecule";
export { use } from "./molecule/use";
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

// testing utilities
export {
	cleanupMolecule,
	cleanupMolecules,
	mountMolecule,
	useMolecule,
} from "./molecule/testing";
