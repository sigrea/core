import { effect } from "../effect";
import type {
	LifecycleCapable,
	MountCallback,
	UnmountCallback,
} from "../lifecycle/types";
import type { Dependency, Link, Subscriber } from "../reactive-system";
import {
	SubscriberFlags,
	endTracking,
	getActiveSub,
	link,
	processComputedUpdate,
	setActiveSub,
	startTracking,
} from "../reactive-system";

export function computed<T>(getter: () => T): Computed<T> {
	return new Computed(getter);
}

const UNINITIALIZED = Symbol("sigrea.computed.uninitialized");

export class Computed<T = unknown>
	implements Subscriber, Dependency, LifecycleCapable
{
	private _value: T | typeof UNINITIALIZED = UNINITIALIZED;

	subs: Link | undefined = undefined;

	subsTail: Link | undefined = undefined;

	deps: Link | undefined = undefined;

	depsTail: Link | undefined = undefined;

	flags: SubscriberFlags = SubscriberFlags.Computed | SubscriberFlags.Dirty;

	private __listenerCount = 0;

	private _mountCallbacks = new Set<MountCallback>();

	private _cleanupFunctions = new Set<() => void>();
	private readonly _activeMountCleanups = new Map<MountCallback, () => void>();

	private _unmountTimer: ReturnType<typeof setTimeout> | undefined = undefined;

	private __isMounted = false;

	private readonly _trackedSubscribers = new WeakSet<Subscriber>();

	private _capturedDependencies:
		| Set<Dependency & { _untrackSubscriber?: (sub: Subscriber) => void }>
		| undefined = undefined;
	private _isUnmountScheduled = false;

	constructor(public readonly getter: () => T) {}

	get value(): T {
		const flags = this.flags;
		if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
			processComputedUpdate(this, flags);
		}

		const activeSub = getActiveSub();
		if (activeSub !== undefined) {
			const wasTracked = this._trackedSubscribers.has(activeSub);
			link(this, activeSub);
			if (!wasTracked) {
				this._trackSubscriber(activeSub);
			}
		}

		const currentValue = this._value;
		if (currentValue === UNINITIALIZED) {
			throw new Error(
				"Computed value accessed before initialization; ensure the getter runs successfully before reading.",
			);
		}

		return currentValue;
	}

	update(): boolean {
		const previous = getActiveSub();
		setActiveSub(this);
		startTracking(this);
		try {
			const oldValue = this._value;
			const nextValue = this.getter();
			if (oldValue === UNINITIALIZED || oldValue !== nextValue) {
				this._value = nextValue;
				return true;
			}
			return false;
		} finally {
			setActiveSub(previous);
			endTracking(this);
			this._refreshCapturedDependencies();
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
				this._cleanupFunctions.delete(cleanup);
				this._activeMountCleanups.delete(callback);
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
			this._isUnmountScheduled = false;
			this._capturedDependencies = undefined;
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

			this._capturedDependencies = this._captureDependencies();
			this._isUnmountScheduled = true;

			this._unmountTimer = setTimeout(() => {
				if (this.__listenerCount === 0) {
					this._unmount();
				}
			}, 1000);
		} catch (error) {
			console.error("Timer scheduling error:", error);
			this._capturedDependencies = this._captureDependencies();
			this._isUnmountScheduled = true;
			if (this.__listenerCount === 0) {
				this._unmount();
			}
		}
	}

	private _captureDependencies(): Set<
		Dependency & { _untrackSubscriber?: (sub: Subscriber) => void }
	> {
		const captured = new Set<
			Dependency & { _untrackSubscriber?: (sub: Subscriber) => void }
		>();
		let linkNode = this.deps;
		while (linkNode !== undefined) {
			const { dep } = linkNode;
			if (dep !== undefined) {
				captured.add(
					dep as Dependency & {
						_untrackSubscriber?: (sub: Subscriber) => void;
					},
				);
			}
			linkNode = linkNode.nextDep;
		}
		return captured;
	}

	private _refreshCapturedDependencies(): void {
		if (!this._isUnmountScheduled) {
			return;
		}

		this._capturedDependencies = this._captureDependencies();
	}

	private _unmount(): void {
		if (this._unmountTimer !== undefined) {
			clearTimeout(this._unmountTimer);
			this._unmountTimer = undefined;
		}

		const captured = this._capturedDependencies;
		if (captured !== undefined && captured.size > 0) {
			for (const dep of captured) {
				if (typeof dep._untrackSubscriber === "function") {
					dep._untrackSubscriber(this);
				}
			}
			captured.clear();
		} else {
			let linkNode = this.deps;
			while (linkNode !== undefined) {
				const { dep } = linkNode;
				if (dep !== undefined) {
					const candidate = dep as UntrackableDependency;
					if (typeof candidate._untrackSubscriber === "function") {
						candidate._untrackSubscriber(this);
					}
				}
				linkNode = linkNode.nextDep;
			}
		}

		this.flags |= SubscriberFlags.Dirty;

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
		this._capturedDependencies = undefined;
		this._isUnmountScheduled = false;
	}
}

type UntrackableDependency = Dependency & {
	_untrackSubscriber?: (sub: Subscriber) => void;
};

export function isComputed<T>(value: unknown): value is Computed<T> {
	return value instanceof Computed;
}

export function onMount<T>(
	store: Computed<T>,
	callback: MountCallback,
): () => void {
	if (!isComputed(store)) {
		throw new TypeError("onMount can only be called on a Computed");
	}

	return store.onMount(callback);
}

export function onUnmount<T>(
	store: Computed<T>,
	callback: UnmountCallback,
): () => void {
	if (!isComputed(store)) {
		throw new TypeError("onUnmount can only be called on a Computed");
	}

	return store.onUnmount(callback);
}

export function keepMount<T>(store: Computed<T>): () => void {
	if (!isComputed(store)) {
		throw new TypeError("keepMount can only be called on a Computed");
	}

	const keeper = effect(() => {
		store.value;
	});

	return () => {
		keeper.stop();
	};
}
