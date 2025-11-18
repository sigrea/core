import { toValue } from "../core/reactivity";

import type { Computed } from "../core/computed";
import { type DeepSignal, trackDeepSignalVersion } from "../core/deepSignal";
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
	watchSource?: () => unknown;
	options?: WatchOptions;
	areEqual?: (next: T, prev: T) => boolean;
	onAccept?: () => void;
}

function createSnapshot<T>(value: T, version: number): Snapshot<T> {
	return { value, version };
}

function createHandler<T>({
	read,
	watchSource,
	options,
	areEqual = Object.is,
	onAccept,
}: HandlerConfig<T>): SnapshotHandler<T> {
	let currentValue = read();
	let version = 0;
	let snapshot = createSnapshot(currentValue, version);

	const getSnapshot = () => snapshot;

	function subscribe(listener: Listener): () => void {
		let stopped = false;
		const normalizedOptions: WatchOptions =
			options === undefined ? { flush: "sync" } : { flush: "sync", ...options };

		const watchGetter = watchSource ?? read;

		const stop: WatchStopHandle = watch(
			watchGetter,
			() => {
				if (stopped) {
					return;
				}

				const value = read();
				if (areEqual(value, currentValue)) {
					return;
				}

				currentValue = value;
				version += 1;
				snapshot = createSnapshot(value, version);
				onAccept?.();
				listener();
			},
			normalizedOptions,
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
	let currentVersion = trackDeepSignalVersion(
		source as DeepSignal<object>,
		false,
	);
	let pendingVersion = currentVersion;
	return createHandler({
		read: () => toValue(source) as T,
		watchSource: () => {
			pendingVersion = trackDeepSignalVersion(
				source as DeepSignal<object>,
				false,
			);
			return pendingVersion;
		},
		areEqual: () => pendingVersion === currentVersion,
		onAccept: () => {
			currentVersion = pendingVersion;
		},
	});
}
