import { effect } from "../effect";
import type {
	LifecycleCapable,
	MountCallback,
	UnmountCallback,
} from "../lifecycle/types";
import type { Dependency, Link, Subscriber } from "../reactive-system";
import {
	getActiveSub,
	getBatchDepth,
	link,
	processEffectNotifications,
	propagate,
} from "../reactive-system";

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(initial: T): Signal<T>;
export function signal<T>(initial?: T): Signal<T | undefined> {
	return new Signal(initial as T | undefined);
}

export class Signal<T = unknown> implements Dependency, LifecycleCapable {
	subs: Link | undefined = undefined;

	subsTail: Link | undefined = undefined;

	private __listenerCount = 0;

	private _mountCallbacks = new Set<MountCallback>();

	private _cleanupFunctions = new Set<() => void>();
	private readonly _activeMountCleanups = new Map<MountCallback, () => void>();

	private _unmountTimer: ReturnType<typeof setTimeout> | undefined = undefined;

	private __isMounted = false;

	private readonly _trackedSubscribers = new WeakSet<Subscriber>();

	constructor(private _value: T) {}

	get value(): T {
		const activeSub = getActiveSub();
		if (activeSub !== undefined) {
			const wasTracked = this._trackedSubscribers.has(activeSub);
			link(this, activeSub);
			if (!wasTracked) {
				this._trackSubscriber(activeSub);
			}
		}

		return this._value;
	}

	set value(next: T) {
		if (this._value === next) {
			return;
		}

		this._value = next;

		const subs = this.subs;
		if (subs !== undefined) {
			propagate(subs);
			if (getBatchDepth() === 0) {
				processEffectNotifications();
			}
		}
	}

	get _listenerCount(): number {
		return this.__listenerCount;
	}

	get _isMounted(): boolean {
		return this.__isMounted;
	}

	onMount(callback: MountCallback): () => void {
		if (typeof callback !== "function") {
			throw new TypeError("Mount callback must be a function");
		}

		this._mountCallbacks.add(callback);

		if (this.__isMounted) {
			this._executeMountCallback(callback);
		}

		return () => {
			this._mountCallbacks.delete(callback);
			const cleanup = this._activeMountCleanups.get(callback);
			if (cleanup !== undefined) {
				this._activeMountCleanups.delete(callback);
				this._cleanupFunctions.delete(cleanup);
				try {
					cleanup();
				} catch (error) {
					console.error("Cleanup function error:", error);
				}
			}
		};
	}

	onUnmount(callback: UnmountCallback): () => void {
		if (typeof callback !== "function") {
			throw new TypeError("Unmount callback must be a function");
		}

		let active = true;
		const cleanup = () => {
			if (!active) {
				return;
			}
			callback();
		};

		const disposeMount = this.onMount(() => cleanup);

		return () => {
			if (!active) {
				return;
			}

			active = false;
			this._cleanupFunctions.delete(cleanup);
			disposeMount();
		};
	}

	_trackSubscriber(subscriber: Subscriber): void {
		if (this._trackedSubscribers.has(subscriber)) {
			return;
		}

		this._trackedSubscribers.add(subscriber);
		this.__listenerCount += 1;

		if (this._unmountTimer !== undefined) {
			clearTimeout(this._unmountTimer);
			this._unmountTimer = undefined;
		}

		if (!this.__isMounted && this.__listenerCount === 1) {
			this._mount();
		}
	}

	_untrackSubscriber(subscriber: Subscriber): void {
		if (!this._trackedSubscribers.has(subscriber)) {
			return;
		}

		this._trackedSubscribers.delete(subscriber);
		this.__listenerCount -= 1;

		if (this.__listenerCount === 0 && this.__isMounted) {
			this._scheduleUnmount();
		}
	}

	private _mount(): void {
		this.__isMounted = true;

		for (const callback of this._mountCallbacks) {
			this._executeMountCallback(callback);
		}
	}

	private _executeMountCallback(
		callback: MountCallback,
	): (() => void) | undefined {
		let registeredCleanup: (() => void) | undefined;
		const previousCleanup = this._activeMountCleanups.get(callback);

		try {
			const cleanup = callback();
			if (typeof cleanup === "function") {
				this._cleanupFunctions.add(cleanup);
				registeredCleanup = cleanup;
			} else if (cleanup !== undefined && cleanup !== null) {
				console.warn("Mount callback returned a non-function value:", cleanup);
			}
		} catch (error) {
			console.error("Mount callback error:", error);
		}

		if (
			previousCleanup !== undefined &&
			previousCleanup !== registeredCleanup
		) {
			this._cleanupFunctions.delete(previousCleanup);
		}

		if (registeredCleanup !== undefined) {
			this._activeMountCleanups.set(callback, registeredCleanup);
		} else {
			this._activeMountCleanups.delete(callback);
		}

		return registeredCleanup;
	}

	private _scheduleUnmount(): void {
		try {
			if (this._unmountTimer !== undefined) {
				clearTimeout(this._unmountTimer);
			}

			this._unmountTimer = setTimeout(() => {
				if (this.__listenerCount === 0) {
					this._unmount();
				}
			}, 1000);
		} catch (error) {
			console.error("Timer scheduling error:", error);
			if (this.__listenerCount === 0) {
				this._unmount();
			}
		}
	}

	private _unmount(): void {
		if (this._unmountTimer !== undefined) {
			clearTimeout(this._unmountTimer);
			this._unmountTimer = undefined;
		}

		for (const cleanup of this._cleanupFunctions) {
			try {
				cleanup();
			} catch (error) {
				console.error("Cleanup function error:", error);
			}
		}

		this._cleanupFunctions.clear();
		this._activeMountCleanups.clear();
		this.__isMounted = false;
	}
}

export function isSignal<T>(value: unknown): value is Signal<T> {
	return value instanceof Signal;
}

export function onMount<T>(
	store: Signal<T>,
	callback: MountCallback,
): () => void {
	if (!isSignal(store)) {
		throw new TypeError("onMount can only be called on a Signal instance");
	}

	return store.onMount(callback);
}

export function onUnmount<T>(
	store: Signal<T>,
	callback: UnmountCallback,
): () => void {
	if (!isSignal(store)) {
		throw new TypeError("onUnmount can only be called on a Signal instance");
	}

	return store.onUnmount(callback);
}

export function keepMount<T>(store: Signal<T>): () => void {
	if (!isSignal(store)) {
		throw new TypeError("keepMount can only be called on a Signal");
	}

	const keeper = effect(() => {
		store.value;
	});

	return () => {
		keeper.stop();
	};
}
