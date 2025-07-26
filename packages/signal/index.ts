import { effect } from "../effect";
import type {
  LifecycleCapable,
  MountCallback,
  UnmountCallback,
} from "../lifecycle";
import type { Dependency, Link, Subscriber } from "../reactive-system";
import {
  getActiveSub,
  getBatchDepth,
  link,
  processEffectNotifications,
  propagate,
} from "../reactive-system";

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(oldValue: T): Signal<T>;
export function signal<T>(oldValue?: T): Signal<T | undefined> {
  return new Signal(oldValue);
}

export class Signal<T = any> implements Dependency, LifecycleCapable {
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  private __listenerCount = 0;
  private _mountCallbacks = new Set<MountCallback>();
  private _cleanupFunctions = new Set<() => void>();
  private _unmountTimer?: ReturnType<typeof setTimeout>;
  private __isMounted = false;
  private _trackedSubscribers = new WeakSet<Subscriber>();

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

  set value(newVal: T) {
    if (this._value !== newVal) {
      this._value = newVal;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs);
        if (!getBatchDepth()) {
          processEffectNotifications();
        }
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
      try {
        const cleanup = callback();
        if (
          cleanup !== undefined &&
          cleanup !== null &&
          typeof cleanup !== "function"
        ) {
          console.warn(
            "Mount callback returned a non-function value:",
            cleanup,
          );
        } else if (typeof cleanup === "function") {
          this._cleanupFunctions.add(cleanup);
        }
      } catch (error) {
        console.error("Mount callback error:", error);
      }
    }

    return () => {
      this._mountCallbacks.delete(callback);
    };
  }

  private _trackSubscriber(subscriber: Subscriber): void {
    if (!this._trackedSubscribers.has(subscriber)) {
      this._trackedSubscribers.add(subscriber);
      this.__listenerCount++;

      if (this._unmountTimer) {
        clearTimeout(this._unmountTimer);
        this._unmountTimer = undefined;
      }

      if (this.__listenerCount === 1 && !this.__isMounted) {
        this._mount();
      }
    }
  }

  // @ts-ignore - _untrackSubscriber is private but needs to be called by
  // reactive system's endTracking function via WeakMap for lifecycle cleanup
  // when dependencies are removed
  private _untrackSubscriber(subscriber: Subscriber): void {
    if (this._trackedSubscribers.has(subscriber)) {
      this._trackedSubscribers.delete(subscriber);
      this.__listenerCount--;

      // Delay unmount by 1 second to handle rapid subscribe/unsubscribe cycles
      if (this.__listenerCount === 0 && this.__isMounted) {
        this._scheduleUnmount();
      }
    }
  }

  private _scheduleUnmount(): void {
    try {
      if (this._unmountTimer) {
        clearTimeout(this._unmountTimer);
      }

      this._unmountTimer = setTimeout(() => {
        if (this.__listenerCount === 0) {
          this._unmount();
        }
      }, 1000);
    } catch (error) {
      console.error("Timer scheduling error:", error);
      // If timer scheduling fails (e.g., in resource-constrained environments),
      // unmount immediately to prevent memory leaks. This trades the 1-second grace period
      // for guaranteed cleanup, prioritizing memory safety over optimization.
      if (this.__listenerCount === 0) {
        this._unmount();
      }
    }
  }

  private _mount(): void {
    this.__isMounted = true;

    for (const callback of this._mountCallbacks) {
      try {
        const cleanup = callback();
        if (typeof cleanup === "function") {
          this._cleanupFunctions.add(cleanup);
        }
      } catch (error) {
        console.error("Mount callback error:", error);
        // Continue executing remaining callbacks - partial initialization
        // is better than complete failure
      }
    }
  }

  private _unmount(): void {
    if (this._unmountTimer) {
      clearTimeout(this._unmountTimer);
      this._unmountTimer = undefined;
    }

    for (const cleanup of this._cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        console.error("Cleanup function error:", error);
        // Continue cleanup even if one fails - others may still release
        // important resources (network connections, timers, etc.)
      }
    }

    this._cleanupFunctions.clear();

    this.__isMounted = false;
  }
}

export function isSignal<T>(value: Signal<T> | any): value is Signal<T> {
  return value instanceof Signal;
}

/**
 * Register a mount callback on a signal
 * The callback will be executed when the signal gains its first subscriber
 * Returns an unsubscribe function
 */
export function onMount<T>(
  store: Signal<T>,
  callback: MountCallback,
): () => void {
  if (!isSignal(store)) {
    throw new TypeError(
      `onMount can only be called on a Signal instance. Received: ${store === null ? "null" : typeof store}`,
    );
  }
  if (typeof callback !== "function") {
    throw new TypeError(
      `Mount callback must be a function. Received: ${callback === null ? "null" : typeof callback}`,
    );
  }
  return store.onMount(callback);
}

/**
 * Register an unmount callback on a signal
 * The callback will be executed when the signal loses its last subscriber
 * Returns an unsubscribe function
 */
export function onUnmount<T>(
  store: Signal<T>,
  callback: UnmountCallback,
): () => void {
  if (!isSignal(store)) {
    throw new TypeError("onUnmount can only be called on a Signal");
  }

  // Trick: register unmount callback as return value of mount callback
  const mountCallback: MountCallback = () => callback;
  return store.onMount(mountCallback);
}

/**
 * Keep a signal mounted until the returned function is called
 * Useful for preventing unmount during temporary subscriber changes
 */
export function keepMount<T>(store: Signal<T>): () => void {
  if (!isSignal(store)) {
    throw new TypeError("keepMount can only be called on a Signal");
  }

  // Keep subscribed via dummy effect
  const keepAlive = effect(() => {
    store.value; // Access to create dependency
  });

  return () => {
    keepAlive.stop();
  };
}
