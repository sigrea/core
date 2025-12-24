// import { __DEV__ } from "../constants";
import {
	type DebuggerHook,
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
	untracked,
} from "./reactivity";

export type { DebuggerHook } from "./reactivity";

import type { Computed } from "./computed";
import {
	type DeepSignal,
	type ReadonlyDeepSignal,
	isDeepSignal,
	trackDeepSignalVersion,
} from "./deepSignal";
import { isPromiseLike, logUnhandledAsyncError } from "./internal/async";
import type { ReadonlySignal } from "./readonly";
import { schedulePostFlush, schedulePreFlush } from "./scheduler";
import { type Cleanup, getCurrentScope, registerScopeCleanup } from "./scope";
import type { Signal } from "./signal";

export type WatchStopHandle = () => void;

type SchedulerJob = (immediateFirstRun?: boolean) => void;

interface AsyncQueueEntry {
	job: SchedulerJob;
	immediateFirstRun?: boolean;
}

type QueueJobFn = (job: SchedulerJob, immediateFirstRun?: boolean) => void;

function createAsyncQueue(
	scheduleFlush: (flush: () => void) => void,
): QueueJobFn {
	const pendingJobs = new Set<SchedulerJob>();
	const queue: AsyncQueueEntry[] = [];
	let flushing = false;

	const flush = () => {
		try {
			while (queue.length > 0) {
				const next = queue.shift();
				if (next === undefined) {
					break;
				}
				const { job, immediateFirstRun } = next;
				pendingJobs.delete(job);
				job(immediateFirstRun);
			}
		} finally {
			flushing = false;
			if (queue.length > 0) {
				scheduleFlush(flush);
			}
		}
	};

	return (job, immediateFirstRun) => {
		if (!pendingJobs.has(job)) {
			pendingJobs.add(job);
			queue.push({ job, immediateFirstRun });
		} else if (immediateFirstRun === true) {
			const existing = queue.find((entry) => entry.job === job);
			if (existing !== undefined) {
				existing.immediateFirstRun = true;
			}
		}
		if (!flushing) {
			flushing = true;
			scheduleFlush(flush);
		}
	};
}

const queuePreFlushJob = createAsyncQueue((flush) => {
	schedulePreFlush(flush);
});

const queuePostFlushJob = createAsyncQueue((flush) => {
	schedulePostFlush(flush);
});

export interface WatchOptions<Immediate = boolean> {
	immediate?: Immediate;
	deep?: boolean | number;
	flush?: WatchFlushType;
	onTrack?: DebuggerHook;
	onTrigger?: DebuggerHook;
}

export type WatchFlushType = "pre" | "post" | "sync";

export type OnCleanup = (cleanupFn: Cleanup) => void;

export type WatchEffect = (
	onCleanup: OnCleanup,
) => void | Cleanup | Promise<void | Cleanup>;

type SingleWatchSource<T> =
	| Signal<T>
	| ReadonlySignal<T>
	| Computed<T>
	| (() => T)
	| (T extends object ? DeepSignal<T> | ReadonlyDeepSignal<T> : never);

export type WatchSource<T = unknown> = SingleWatchSource<T>;

type WatchSourceList<T extends readonly unknown[]> = {
	[K in keyof T]: WatchSource<T[K]>;
};

type AnyWatchSource =
	| WatchSource<unknown>
	| DeepSignal<object>
	| ReadonlyDeepSignal<object>;

type UnwrapWatchSource<S> = S extends Signal<infer V>
	? V
	: S extends ReadonlySignal<infer V>
		? V
		: S extends Computed<infer V>
			? V
			: S extends () => infer V
				? V
				: S extends DeepSignal<infer V>
					? V
					: S extends ReadonlyDeepSignal<infer V>
						? V
						: S;

type WatchSourceValues<Sources extends readonly AnyWatchSource[]> = {
	[K in keyof Sources]: UnwrapWatchSource<Sources[K]>;
};

// biome-ignore lint/suspicious/noExplicitAny: implementation signature must accept any callback shape
type AnyWatchCallback = WatchCallback<any, any>;

export type WatchCallback<V = unknown, OV = unknown> = (
	value: V,
	oldValue: OV,
	onCleanup: OnCleanup,
) => void | Cleanup | Promise<void | Cleanup>;

const INITIAL_WATCHER_VALUE: unknown = {};

const NOOP_ON_CLEANUP: OnCleanup = () => {
	// if (__DEV__) {
	// 	console.warn("onCleanup() called with no active watch run.");
	// }
};

class Watcher {
	private readonly effect: Effect<unknown>;
	private readonly getter: () => unknown;
	private readonly callback?: AnyWatchCallback;
	private readonly deepOption: WatchOptions["deep"];
	private readonly deepEnabled: boolean;
	private readonly isMultiSource: boolean;
	private readonly isDeepSignalSource: boolean;
	private hasDeepSignalArrayEntry = false;
	private detachFromScope: (() => void) | undefined;
	private cleanup: Cleanup | undefined;
	private cleanupRunId = 0;
	private activeCleanupRunId = 0;
	private currentOnCleanup: OnCleanup = NOOP_ON_CLEANUP;
	private oldValue: unknown;
	private stopped = false;

	constructor(
		source: unknown,
		callback: AnyWatchCallback | undefined,
		options: WatchOptions,
	) {
		this.callback = callback;
		this.deepOption = this.resolveDeepOption(source, options.deep);
		this.deepEnabled = callback !== undefined && this.deepOption !== undefined;

		const { getter, isMultiSource, isDeepSignalSource } = this.createGetter(
			source,
			callback !== undefined,
		);
		this.getter = this.wrapGetterForDeepOption(getter);
		this.isMultiSource = isMultiSource;
		this.isDeepSignalSource = isDeepSignalSource;
		this.oldValue =
			isMultiSource && isArray(source)
				? new Array(source.length).fill(INITIAL_WATCHER_VALUE)
				: INITIAL_WATCHER_VALUE;

		this.effect = new Effect(() => this.getter());
		this.effect.onTrack = options.onTrack;
		this.effect.onTrigger = options.onTrigger;
		const flushMode: WatchFlushType = options.flush ?? "pre";
		const job = (immediateFirstRun?: boolean) => {
			this.schedule(immediateFirstRun);
		};
		if (flushMode === "sync") {
			this.effect.scheduler = job;
		} else if (flushMode === "post") {
			this.effect.scheduler = (immediateFirstRun?: boolean) => {
				queuePostFlushJob(job, immediateFirstRun);
			};
		} else {
			this.effect.scheduler = (immediateFirstRun?: boolean) => {
				queuePreFlushJob(job, immediateFirstRun);
			};
		}
	}

	private prepareCleanupContext(): {
		context: number;
		onCleanup: OnCleanup;
	} {
		this.cleanupRunId += 1;
		const context = this.cleanupRunId;
		this.activeCleanupRunId = context;
		return {
			context,
			onCleanup: this.createOnCleanup(context),
		};
	}

	private createOnCleanup(context: number): OnCleanup {
		return (cleanupFn) => {
			this.assignCleanup(cleanupFn, context);
		};
	}

	private assignCleanup(cleanupFn: Cleanup, context: number): void {
		if (this.stopped) {
			this.invokeCleanup(cleanupFn, false);
			return;
		}
		if (context !== this.activeCleanupRunId) {
			if (context < this.activeCleanupRunId) {
				this.invokeCleanup(cleanupFn, false);
			}
			return;
		}
		this.cleanup = cleanupFn;
	}

	private handleCallbackResult(
		result: unknown,
		context: number,
		label: string,
	): void {
		if (typeof result === "function") {
			this.assignCleanup(result as Cleanup, context);
			return;
		}

		if (isPromiseLike(result)) {
			Promise.resolve(result)
				.then((resolved) => {
					this.handleCallbackResult(resolved, context, label);
				})
				.catch((error) => {
					logUnhandledAsyncError(label, error);
				});
		}
	}

	private invokeCleanup(cleanupFn: Cleanup, throwOnError: boolean): void {
		try {
			const result = cleanupFn();
			if (isPromiseLike(result)) {
				Promise.resolve(result).catch((error) => {
					logUnhandledAsyncError("watch cleanup", error);
				});
			}
		} catch (error) {
			if (throwOnError) {
				throw error;
			}
			logUnhandledAsyncError("watch cleanup", error);
		}
	}

	initialize(immediate: boolean | undefined): void {
		if (this.callback !== undefined) {
			if (immediate) {
				this.schedule(true);
				return;
			}

			const { onCleanup } = this.prepareCleanupContext();
			this.currentOnCleanup = onCleanup;
			this.oldValue = this.effect.run();
			this.currentOnCleanup = NOOP_ON_CLEANUP;
			return;
		}

		const { onCleanup } = this.prepareCleanupContext();
		this.currentOnCleanup = onCleanup;
		this.effect.run();
		this.currentOnCleanup = NOOP_ON_CLEANUP;
	}

	setScopeDetacher(detach: (() => void) | undefined): void {
		this.detachFromScope = detach;
	}

	stop(): void {
		if (this.stopped) {
			return;
		}
		this.stopped = true;
		this.activeCleanupRunId = 0;
		this.currentOnCleanup = NOOP_ON_CLEANUP;
		this.detachFromScope?.();
		this.detachFromScope = undefined;
		this.runCleanup();
		this.effect.stop();
	}

	private schedule(immediateFirstRun?: boolean): void {
		if (this.stopped) {
			return;
		}

		if (!immediateFirstRun && !this.effect.shouldUpdate) {
			return;
		}

		if (this.callback !== undefined) {
			const newValue = this.effect.run();
			const dependencyTriggered = immediateFirstRun !== true;
			const fallbackChanged = this.computeFallbackChanged(newValue);
			const forced = dependencyTriggered && this.shouldForceTrigger(newValue);

			const changed = forced || fallbackChanged;

			// if (__DEV__) {
			// 	console.log("watch-debug", {
			// 		dependencyTriggered,
			// 		fallbackChanged,
			// 		forced,
			// 		changed,
			// 	});
			// }

			if (changed) {
				const { context, onCleanup } = this.prepareCleanupContext();
				const formattedOldValue = this.normalizeOldValue();
				this.runCleanup();
				const result = this.callback(newValue, formattedOldValue, onCleanup);
				this.handleCallbackResult(result, context, "watch callback");
				this.refreshOldValue(newValue);
			}
			return;
		}

		const { onCleanup } = this.prepareCleanupContext();
		this.currentOnCleanup = onCleanup;
		this.runCleanup();
		try {
			this.effect.run();
		} finally {
			this.currentOnCleanup = NOOP_ON_CLEANUP;
		}
	}

	private createGetter(
		source: unknown,
		trackReturnValue: boolean,
	): {
		getter: () => unknown;
		isMultiSource: boolean;
		isDeepSignalSource: boolean;
	} {
		if (isSignal(source)) {
			return {
				getter: () => (source as Signal<unknown>).value,
				isMultiSource: false,
				isDeepSignalSource: false,
			};
		}

		if (isDeepSignal(source)) {
			const deepSource = source as DeepSignal<object>;
			return {
				getter: () => this.readDeepSignalSource(deepSource),
				isMultiSource: false,
				isDeepSignalSource: true,
			};
		}

		if (isArray(source)) {
			const arraySource = source as readonly unknown[];
			this.hasDeepSignalArrayEntry = arraySource.some((entry) =>
				isDeepSignal(entry),
			);
			return {
				getter: () =>
					arraySource.map((entry) => this.normalizeArrayEntry(entry)),
				isMultiSource: true,
				isDeepSignalSource: false,
			};
		}

		if (isFunction(source)) {
			if (trackReturnValue) {
				const baseGetter = source as () => unknown;
				return {
					getter: () => baseGetter(),
					isMultiSource: false,
					isDeepSignalSource: false,
				};
			}

			const effectSource = source as WatchEffect;
			return {
				getter: () => {
					const result = effectSource(this.currentOnCleanup);
					this.handleCallbackResult(
						result,
						this.activeCleanupRunId,
						"watch effect",
					);
				},
				isMultiSource: false,
				isDeepSignalSource: false,
			};
		}

		return {
			getter: () => {
				// if (__DEV__) {
				// 	console.warn(
				// 		"Invalid watch source. Source must be a signal, a computed value !",
				// 	);
				// }
				return NOOP();
			},
			isMultiSource: false,
			isDeepSignalSource: false,
		};
	}

	private wrapGetterForDeepOption(getter: () => unknown): () => unknown {
		if (this.callback === undefined) {
			return getter;
		}

		if (!this.deepEnabled) {
			return getter;
		}

		if (this.shouldUseDeepSignalVersionTracking()) {
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
			this.hasDeepSignalArrayEntry = true;
			if (this.shouldUseDeepSignalVersionTracking()) {
				return this.readDeepSignalSource(deepEntry);
			}
			if (this.deepOption !== undefined) {
				return this.traverseDeepSignalEntry(deepEntry);
			}
			return this.readDeepSignalSource(deepEntry);
		}
		if (isFunction(entry)) {
			return (entry as () => unknown)();
		}
		// if (__DEV__) {
		// 	console.warn(
		// 		"Invalid watch source entry. Entries must be signals, deep signals, or getter functions.",
		// 	);
		// }
		return entry;
	}

	private readDeepSignalSource(source: DeepSignal<object>): object {
		if (this.shouldUseDeepSignalVersionTracking()) {
			const shallowOnly = this.deepOption === false;
			trackDeepSignalVersion(source, shallowOnly);
			return source as object;
		}
		if (this.shouldShallowTraverseDeepSignal()) {
			return this.traverse(source, 1) as object;
		}
		return source as object;
	}

	private traverseDeepSignalEntry(source: DeepSignal<object>): object {
		const depth = this.resolveTraverseDepth();
		if (depth <= 0) {
			return source as object;
		}
		return this.traverse(source, depth) as object;
	}

	private shouldShallowTraverseDeepSignal(): boolean {
		return this.deepOption === undefined;
	}

	private shouldUseDeepSignalVersionTracking(): boolean {
		if (typeof this.deepOption === "number") {
			return false;
		}
		if (this.isDeepSignalSource) {
			return true;
		}
		if (this.isMultiSource && this.hasDeepSignalArrayEntry) {
			return true;
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

	private shouldForceTrigger(newValue: unknown): boolean {
		if (this.isDeepSignalSource) {
			return true;
		}
		if (this.isMultiSource && this.hasDeepSignalArrayEntry) {
			return true;
		}
		if (this.deepOption === undefined || this.deepOption === false) {
			return false;
		}
		if (this.deepOption === true) {
			return isObject(newValue);
		}
		if (typeof this.deepOption === "number") {
			return isObject(newValue);
		}
		return false;
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

	private resolveDeepOption(
		source: unknown,
		option: WatchOptions["deep"],
	): WatchOptions["deep"] {
		if (option !== undefined) {
			return option;
		}
		if (isDeepSignal(source)) {
			return true;
		}
		if (isArray(source)) {
			const arraySource = source as readonly unknown[];
			if (arraySource.some((entry) => isDeepSignal(entry))) {
				return true;
			}
		}
		return undefined;
	}

	private resolveTraverseDepth(): number {
		if (this.deepOption === false) {
			return 1;
		}
		if (this.deepOption === true) {
			return Number.POSITIVE_INFINITY;
		}
		if (typeof this.deepOption === "number") {
			if (!Number.isFinite(this.deepOption)) {
				return Number.POSITIVE_INFINITY;
			}
			const normalized = this.deepOption <= 0 ? 0 : this.deepOption;
			return normalized + 1;
		}
		return Number.POSITIVE_INFINITY;
	}

	private runCleanup(): void {
		if (this.cleanup === undefined) {
			return;
		}
		const cleanupToRun = this.cleanup;
		this.cleanup = undefined;
		this.invokeCleanup(cleanupToRun, true);
	}

	private traverse(
		value: unknown,
		depth = Number.POSITIVE_INFINITY,
		seen?: Set<unknown>,
	): unknown {
		if (
			depth <= 0 ||
			!isObject(value) ||
			(value as Record<string, unknown>)[SignalFlags.SKIP]
		) {
			return value;
		}

		const nextSeen = seen ?? new Set<unknown>();
		if (nextSeen.has(value)) {
			return value;
		}
		nextSeen.add(value);
		const nextDepth = depth - 1;

		if (isSignal(value)) {
			this.traverse((value as Signal<unknown>).value, nextDepth, nextSeen);
		} else if (isArray(value)) {
			for (let index = 0; index < value.length; index += 1) {
				this.traverse(value[index], nextDepth, nextSeen);
			}
		} else if (isSet(value)) {
			for (const entry of value) {
				this.traverse(entry, nextDepth, nextSeen);
			}
		} else if (isMap(value)) {
			for (const [key, entry] of value) {
				this.traverse(key, nextDepth, nextSeen);
				this.traverse(entry, nextDepth, nextSeen);
			}
		} else if (isPlainObject(value)) {
			const objectValue = value as Record<PropertyKey, unknown>;
			for (const key of Object.keys(objectValue)) {
				this.traverse(objectValue[key], nextDepth, nextSeen);
			}
			for (const key of Object.getOwnPropertySymbols(objectValue)) {
				if (Object.prototype.propertyIsEnumerable.call(objectValue, key)) {
					this.traverse(objectValue[key], nextDepth, nextSeen);
				}
			}
		}

		return value;
	}

	private refreshOldValue(newValue: unknown): void {
		if (this.callback === undefined) {
			this.oldValue = newValue;
			return;
		}
		this.oldValue = untracked(() => this.getter());
	}
}

export function watch<Sources extends readonly AnyWatchSource[]>(
	source: readonly [...Sources],
	callback?: WatchCallback<
		WatchSourceValues<Sources>,
		WatchSourceValues<Sources>
	>,
	options?: WatchOptions,
): WatchStopHandle;
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
	callback?: AnyWatchCallback,
	options?: WatchOptions,
): WatchStopHandle {
	const normalizedOptions: WatchOptions = options ?? {};
	const watcher = new Watcher(source, callback, normalizedOptions);

	const scope = getCurrentScope();
	let detach: (() => void) | undefined;
	if (scope !== undefined) {
		detach = registerScopeCleanup(() => {
			watcher.stop();
		}, scope);
	}
	watcher.setScopeDetacher(detach);

	watcher.initialize(normalizedOptions.immediate);

	return () => {
		watcher.stop();
	};
}
