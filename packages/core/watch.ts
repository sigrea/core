import {
	Effect,
	NOOP,
	SignalFlags,
	hasChanged,
	isArray,
	isFunction,
	isMap,
	isObject,
	isPlainObject,
	isSet,
	isSignal,
} from "./reactivity";

import type { Computed } from "./computed";
import {
	type DeepSignal,
	isDeepSignal,
	trackDeepSignalShallowVersion,
	trackDeepSignalVersion,
} from "./deepSignal";
import { getCurrentScope, registerScopeCleanup } from "./scope";
import type { Signal } from "./signal";

export type WatchStopHandle = () => void;

export interface WatchOptions<Immediate = boolean> {
	immediate?: Immediate;
	deep?: boolean | number;
	once?: boolean;
}

export type OnCleanup = (cleanupFn: () => void) => void;

export type WatchEffect = (onCleanup: OnCleanup) => void;

type SingleWatchSource<T> =
	| Signal<T>
	| Computed<T>
	| (() => T)
	| (T extends object ? DeepSignal<T> : never);

export type WatchSource<T> = SingleWatchSource<T>;

type WatchSourceList<T extends readonly unknown[]> = {
	[K in keyof T]: SingleWatchSource<T[K]>;
};

export type WatchCallback<V = unknown, OV = unknown> = (
	value: V,
	oldValue: OV,
	onCleanup: OnCleanup,
) => unknown;

const INITIAL_WATCHER_VALUE: unknown = {};

class Watcher {
	private readonly effect: Effect<unknown>;
	private readonly getter: () => unknown;
	private readonly callback?: WatchCallback;
	private readonly once: boolean;
	private readonly deepOption: WatchOptions["deep"];
	private readonly deepEnabled: boolean;
	private readonly isMultiSource: boolean;
	private readonly registerCleanup: OnCleanup;
	private readonly versionMode: "deep" | "shallow";
	private detachFromScope: (() => void) | undefined;
	private currentVersions: number[] = [];
	private lastVersions: number[] = [];
	private cleanup: (() => void) | undefined;
	private oldValue: unknown;
	private stopped = false;

	constructor(
		source: unknown,
		callback: WatchCallback | undefined,
		options: WatchOptions,
	) {
		this.callback = callback;
		this.once = options.once === true;
		this.deepOption = options.deep;
		this.deepEnabled = callback !== undefined && options.deep !== undefined;
		this.versionMode = this.resolveVersionMode();

		const { getter, isMultiSource } = this.createGetter(
			source,
			callback !== undefined,
		);
		this.getter = this.wrapGetterForDeepOption(getter);
		this.isMultiSource = isMultiSource;
		this.oldValue =
			isMultiSource && isArray(source)
				? new Array(source.length).fill(INITIAL_WATCHER_VALUE)
				: INITIAL_WATCHER_VALUE;

		this.effect = new Effect(() => this.getter());
		this.effect.scheduler = (immediateFirstRun?: boolean) => {
			this.schedule(immediateFirstRun);
		};

		this.registerCleanup = (cleanupFn: () => void) => {
			this.cleanup = cleanupFn;
		};
	}

	initialize(immediate: boolean | undefined): void {
		if (this.callback !== undefined) {
			if (immediate) {
				this.schedule(true);
				return;
			}

			this.currentVersions = [];
			this.oldValue = this.effect.run();
			this.consumeVersionChange();
			return;
		}

		this.currentVersions = [];
		this.effect.run();
		this.consumeVersionChange();
	}

	setScopeDetacher(detach: (() => void) | undefined): void {
		this.detachFromScope = detach;
	}

	stop(): void {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		this.detachFromScope?.();
		this.detachFromScope = undefined;
		this.runCleanup();
		this.effect.stop();
	}

	private schedule(immediateFirstRun?: boolean): void {
		if (this.stopped) {
			return;
		}

		this.currentVersions = [];
		if (!immediateFirstRun && !this.effect.shouldUpdate) {
			return;
		}

		if (this.callback !== undefined) {
			const newValue = this.effect.run();

			const hasVersionInfo = this.currentVersions.length > 0;
			const versionsChanged = hasVersionInfo
				? this.consumeVersionChange()
				: false;

			const fallbackChanged = this.computeFallbackChanged(newValue);

			const changed = versionsChanged || fallbackChanged;

			if (process.env.DEBUG_WATCH === "true") {
				console.log("watch-debug", {
					currentVersions: this.currentVersions,
					versionsChanged,
					fallbackChanged,
					hasVersionInfo,
					changed,
				});
			}

			if (changed) {
				const formattedOldValue = this.normalizeOldValue();
				this.runCleanup();
				this.callback(newValue, formattedOldValue, this.registerCleanup);
				this.oldValue = newValue;
				if (this.once) {
					this.stop();
				}
			}
			return;
		}

		this.runCleanup();
		this.effect.run();
		if (this.once) {
			this.stop();
		}
	}

	private createGetter(
		source: unknown,
		trackReturnValue: boolean,
	): {
		getter: () => unknown;
		isMultiSource: boolean;
	} {
		if (isSignal(source)) {
			return {
				getter: () => (source as Signal<unknown>).value,
				isMultiSource: false,
			};
		}

		if (isDeepSignal(source)) {
			const deepSource = source as DeepSignal<object>;
			const shouldRecordImmediately =
				this.deepOption === undefined || this.deepOption === false;
			return {
				getter: () => {
					if (shouldRecordImmediately) {
						this.recordVersion(deepSource, this.versionMode);
					}
					return this.readDeepSignalSource(deepSource);
				},
				isMultiSource: false,
			};
		}

		if (isArray(source)) {
			const arraySource = source as readonly unknown[];
			return {
				getter: () =>
					arraySource.map((entry) => this.normalizeArrayEntry(entry)),
				isMultiSource: true,
			};
		}

		if (isFunction(source)) {
			if (trackReturnValue) {
				const baseGetter = source as () => unknown;
				return {
					getter: () => {
						const value = baseGetter();
						this.recordVersion(value);
						return value;
					},
					isMultiSource: false,
				};
			}

			const effectSource = source as WatchEffect;
			return {
				getter: () => effectSource(this.registerCleanup),
				isMultiSource: false,
			};
		}

		return {
			getter: () => {
				if (process.env.NODE_ENV !== "production") {
					console.warn(
						"Invalid watch source. Source must be a signal, a computed value !",
					);
				}
				return NOOP();
			},
			isMultiSource: false,
		};
	}

	private wrapGetterForDeepOption(getter: () => unknown): () => unknown {
		if (this.callback === undefined) {
			return getter;
		}

		if (!this.deepEnabled) {
			return getter;
		}

		const depth = this.resolveTraverseDepth();

		return () => this.traverse(getter(), depth);
	}

	private normalizeArrayEntry(entry: unknown): unknown {
		if (isSignal(entry)) {
			return (entry as Signal<unknown>).value;
		}
		if (isDeepSignal(entry)) {
			const deepEntry = entry as DeepSignal<object>;
			this.recordVersion(deepEntry, this.versionMode);
			return this.readDeepSignalSource(deepEntry);
		}
		if (isFunction(entry)) {
			const value = (entry as () => unknown)();
			this.recordVersion(value);
			return value;
		}
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				"Invalid watch source entry. Entries must be signals, deep signals, or getter functions.",
			);
		}
		return entry;
	}

	private readDeepSignalSource(source: DeepSignal<object>): object {
		if (this.shouldShallowTraverseDeepSignal()) {
			return this.traverse(source, 1) as object;
		}
		return source as object;
	}

	private shouldShallowTraverseDeepSignal(): boolean {
		if (this.deepOption === undefined) {
			return true;
		}
		if (this.deepOption === false) {
			return true;
		}
		if (typeof this.deepOption === "number") {
			return this.deepOption === 0;
		}
		return false;
	}

	private computeFallbackChanged(newValue: unknown): boolean {
		if (this.isMultiSource && isArray(newValue)) {
			const previous = this.oldValue as unknown[];
			for (let index = 0; index < newValue.length; index += 1) {
				if (hasChanged(newValue[index], previous[index])) {
					return true;
				}
			}
			return false;
		}

		return hasChanged(newValue, this.oldValue);
	}

	private normalizeOldValue(): unknown {
		if (this.oldValue === INITIAL_WATCHER_VALUE) {
			return undefined;
		}

		if (
			this.isMultiSource &&
			isArray(this.oldValue) &&
			(this.oldValue as unknown[])[0] === INITIAL_WATCHER_VALUE
		) {
			return [];
		}

		return this.oldValue;
	}

	private consumeVersionChange(): boolean {
		if (this.currentVersions.length === 0) {
			this.lastVersions = [];
			return false;
		}

		let changed = this.currentVersions.length !== this.lastVersions.length;
		if (!changed) {
			for (let index = 0; index < this.currentVersions.length; index += 1) {
				if (this.currentVersions[index] !== this.lastVersions[index]) {
					changed = true;
					break;
				}
			}
		}
		this.lastVersions = this.currentVersions.slice();
		return changed;
	}

	private recordVersion(
		value: unknown,
		mode: "deep" | "shallow" = this.versionMode,
	): void {
		if (this.callback === undefined || !isDeepSignal(value)) {
			return;
		}
		const deepValue = value as DeepSignal<object>;
		if (mode === "deep") {
			this.currentVersions.push(trackDeepSignalVersion(deepValue));
			return;
		}
		this.currentVersions.push(trackDeepSignalShallowVersion(deepValue));
	}

	private resolveTraverseDepth(): number {
		if (this.deepOption === false) {
			return 1;
		}
		if (this.deepOption === true) {
			return Number.POSITIVE_INFINITY;
		}
		if (typeof this.deepOption === "number") {
			return this.deepOption;
		}
		return Number.POSITIVE_INFINITY;
	}

	private resolveVersionMode(): "deep" | "shallow" {
		if (this.deepOption === true) {
			return "deep";
		}
		if (typeof this.deepOption === "number") {
			return Number.isFinite(this.deepOption) ? "shallow" : "deep";
		}
		return "shallow";
	}

	private runCleanup(): void {
		if (this.cleanup === undefined) {
			return;
		}
		const cleanupToRun = this.cleanup;
		this.cleanup = undefined;
		cleanupToRun();
	}

	private traverse(
		value: unknown,
		depth = Number.POSITIVE_INFINITY,
		seen?: Set<unknown>,
	): unknown {
		if (isDeepSignal(value)) {
			if (depth === Number.POSITIVE_INFINITY) {
				this.recordVersion(value as DeepSignal<object>, "deep");
				return value;
			}
			if (
				typeof this.deepOption === "number" &&
				Number.isFinite(this.deepOption)
			) {
				if (depth <= 0) {
					const mode = this.deepOption === 0 ? "shallow" : "deep";
					this.recordVersion(value as DeepSignal<object>, mode);
				}
			}
		}

		if (
			depth <= 0 ||
			!isObject(value) ||
			(value as Record<string, unknown>)[SignalFlags.SKIP]
		) {
			return value;
		}

		seen = seen ?? new Set();
		if (seen.has(value)) {
			return value;
		}
		seen.add(value);
		depth -= 1;

		if (isSignal(value)) {
			this.traverse((value as Signal<unknown>).value, depth, seen);
		} else if (isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				this.traverse(value[index], depth, seen);
			}
		} else if (isSet(value) || isMap(value)) {
			(value as Set<unknown> | Map<unknown, unknown>).forEach((entry) => {
				this.traverse(entry, depth, seen);
			});
		} else if (isPlainObject(value)) {
			const objectValue = value as Record<PropertyKey, unknown>;
			for (const key of Object.keys(objectValue)) {
				this.traverse(objectValue[key], depth, seen);
			}
			for (const key of Object.getOwnPropertySymbols(objectValue)) {
				if (Object.prototype.propertyIsEnumerable.call(objectValue, key)) {
					this.traverse(objectValue[key], depth, seen);
				}
			}
		}

		return value;
	}
}

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
	options: WatchOptions = {},
): WatchStopHandle {
	const watcher = new Watcher(source, callback, options);

	const scope = getCurrentScope();
	const detach = registerScopeCleanup(() => {
		watcher.stop();
	}, scope);
	watcher.setScopeDetacher(detach);

	watcher.initialize(options.immediate);

	return () => {
		watcher.stop();
	};
}
