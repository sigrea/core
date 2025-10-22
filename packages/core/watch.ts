import {
	type WatchEffect,
	type WatchCallback as _WatchCallback,
	type WatchOptions as _WatchOptions,
	type WatchSource as _WatchSource,
	watch as _watch,
} from "alien-deepsignals";

import type { Computed } from "./computed";
import type { DeepSignal } from "./deepSignal";
import { getCurrentScope, registerScopeCleanup } from "./scope";
import type { Signal } from "./signal";

export type WatchStopHandle = () => void;
export type WatchOptions<Immediate = boolean> = _WatchOptions<Immediate>;
export type WatchCallback<V = unknown, OV = unknown> = _WatchCallback<V, OV>;

type SingleWatchSource<T> =
	| Signal<T>
	| Computed<T>
	| (() => T)
	| (T extends object ? DeepSignal<T> : never);

export type WatchSource<T> = SingleWatchSource<T>;
type WatchSourceList<T extends readonly unknown[]> = {
	[K in keyof T]: SingleWatchSource<T[K]>;
};

type InnerWatchSource<T> = _WatchSource<T>;

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
		| WatchEffect
		| object;

	const handle = _watch(
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
