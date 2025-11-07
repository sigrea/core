import { toValue } from "../core/reactivity";

import type { Computed } from "../core/computed";
import type { DeepSignal } from "../core/deepSignal";
import type { Signal } from "../core/signal";
import { type WatchOptions, type WatchStopHandle, watch } from "../core/watch";

type Listener = () => void;

export interface Snapshot<T> {
	value: T;
	version: number;
}

export interface SnapshotHandler<T> {
	getSnapshot(): Snapshot<T>;
	subscribe(listener: Listener): () => void;
}

interface HandlerConfig<T> {
	read: () => T;
	options?: WatchOptions;
	areEqual?: (next: T, prev: T) => boolean;
}

function createSnapshot<T>(value: T, version: number): Snapshot<T> {
	return { value, version };
}

function createHandler<T>({
	read,
	options,
	areEqual = Object.is,
}: HandlerConfig<T>): SnapshotHandler<T> {
	let currentValue = read();
	let version = 0;
	let snapshot = createSnapshot(currentValue, version);

	const getSnapshot = () => snapshot;

	function subscribe(listener: Listener): () => void {
		let stopped = false;

		const stop: WatchStopHandle = watch(
			read,
			(value) => {
				if (stopped) {
					return;
				}

				if (areEqual(value, currentValue)) {
					return;
				}

				currentValue = value;
				version += 1;
				snapshot = createSnapshot(value, version);
				listener();
			},
			options,
		);

		return () => {
			if (stopped) {
				return;
			}
			stopped = true;
			stop();
		};
	}

	return { getSnapshot, subscribe };
}

export function createSignalHandler<T>(source: Signal<T>): SnapshotHandler<T> {
	return createHandler({
		read: () => source.value,
	});
}

export function createComputedHandler<T>(
	source: Computed<T>,
): SnapshotHandler<T> {
	return createHandler({
		read: () => source.value,
	});
}

export function createDeepSignalHandler<T extends object>(
	source: DeepSignal<T>,
): SnapshotHandler<T> {
	return createHandler({
		read: () => toValue(source) as T,
		options: { deep: true },
		areEqual: () => false,
	});
}
