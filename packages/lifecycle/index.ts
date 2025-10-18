export type {
	LifecycleCapable,
	MountCallback,
	UnmountCallback,
} from "./types";
export { isLifecycleCapable } from "./types";

import type { Computed } from "../computed";
import {
	isComputed,
	keepMount as keepComputedMounted,
	onMount as onComputedMount,
	onUnmount as onComputedUnmount,
} from "../computed";
import type { Signal } from "../signal";
import {
	isSignal,
	keepMount as keepSignalMounted,
	onMount as onSignalMount,
	onUnmount as onSignalUnmount,
} from "../signal";
import type { MountCallback, UnmountCallback } from "./types";

export function onMount<T>(
	store: Signal<T> | Computed<T>,
	callback: MountCallback,
): () => void {
	if (isSignal(store)) {
		return onSignalMount(store, callback);
	}

	if (isComputed(store)) {
		return onComputedMount(store, callback);
	}

	throw new TypeError(
		"onMount can only be called on a Signal or Computed instance.",
	);
}

export function onUnmount<T>(
	store: Signal<T> | Computed<T>,
	callback: UnmountCallback,
): () => void {
	if (isSignal(store)) {
		return onSignalUnmount(store, callback);
	}

	if (isComputed(store)) {
		return onComputedUnmount(store, callback);
	}

	throw new TypeError(
		"onUnmount can only be called on a Signal or Computed instance.",
	);
}

export function keepMount<T>(store: Signal<T> | Computed<T>): () => void {
	if (isSignal(store)) {
		return keepSignalMounted(store);
	}

	if (isComputed(store)) {
		return keepComputedMounted(store);
	}

	throw new TypeError(
		"keepMount can only be called on a Signal or Computed instance.",
	);
}
