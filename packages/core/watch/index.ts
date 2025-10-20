import {
	type Computed as AlienComputed,
	type Signal as AlienSignal,
	type WatchCallback as AlienWatchCallback,
	type WatchEffect as AlienWatchEffect,
	type WatchOptions as AlienWatchOptions,
	type WatchSource as AlienWatchSource,
	watch as createWatch,
} from "alien-deepsignals";

import type { Computed } from "../computed";
import type { DeepSignal } from "../deepSignal";
import { getCurrentScope, registerScopeCleanup } from "../scope";
import type { Signal } from "../signal";

export type WatchStopHandle = () => void;

export type WatchOptions<Immediate = boolean> = AlienWatchOptions<Immediate>;
export type WatchEffect = AlienWatchEffect;
export type WatchCallback<V = unknown, OV = unknown> = AlienWatchCallback<
	V,
	OV
>;
type SingleWatchSource<T> =
	| Signal<T>
	| Computed<T>
	| (() => T)
	| (T extends object ? DeepSignal<T> : never);

export type WatchSource<T> = SingleWatchSource<T>;
type WatchSourceList<T extends readonly unknown[]> = {
	[K in keyof T]: SingleWatchSource<T[K]>;
};

type InnerWatchSource<T> = AlienWatchSource<T>;

export function watch<T extends readonly unknown[]>(
	source: WatchSourceList<T>,
	callback?: WatchCallback<T, T>,
	options?: WatchOptions,
): WatchStopHandle;
export function watch<T>(
	source: WatchSource<T>,
	callback?: WatchCallback<T, T>,
	options?: WatchOptions,
): WatchStopHandle;
export function watch(
	source: WatchEffect,
	callback?: undefined,
	options?: WatchOptions,
): WatchStopHandle;
export function watch(
	source: unknown,
	callback?: WatchCallback,
	options?: WatchOptions,
): WatchStopHandle {
	const innerSource = source as
		| InnerWatchSource<unknown>
		| InnerWatchSource<unknown>[]
		| AlienWatchEffect
		| object;

	const handle = createWatch(
		innerSource,
		callback as WatchCallback | undefined,
		options,
	);

	let stopped = false;
	let detachFromScope: (() => void) | undefined;

	const scope = getCurrentScope();
	if (scope !== undefined) {
		detachFromScope = registerScopeCleanup(() => stop(), scope);
	}

	function stop() {
		if (stopped) {
			return;
		}
		stopped = true;
		detachFromScope?.();
		handle();
	}

	return stop;
}

export function watchEffect(effect: WatchEffect): WatchStopHandle {
	return watch(effect);
}
