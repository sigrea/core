import { effect } from "../effect";
import type {
  LifecycleCapable,
  MountCallback,
  UnmountCallback,
} from "../lifecycle";
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
import type { Signal } from "../signal";

export function computed<T>(getter: () => T): Computed<T> {
  return new Computed<T>(getter);
}

export class Computed<T = any>
  implements Subscriber, Dependency, LifecycleCapable
{
  _value: T | undefined = undefined;

  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Computed | SubscriberFlags.Dirty;

  // Lifecycle properties
  private __listenerCount = 0;
  private _mountCallbacks = new Set<MountCallback>();
  private _cleanupFunctions = new Set<() => void>();
  private _unmountTimer?: ReturnType<typeof setTimeout>;
  private __isMounted = false;
  private _trackedSubscribers = new WeakSet<Subscriber>();
  private _capturedDependencies?: Set<any>;

  constructor(public getter: () => T) {}

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
    return this._value as T;
  }

  update(): boolean {
    const prevSub = getActiveSub();
    setActiveSub(this);
    startTracking(this);
    try {
      const oldValue = this._value;
      const newValue = this.getter();
      if (oldValue !== newValue) {
        this._value = newValue;
        return true;
      }
      return false;
    } finally {
      setActiveSub(prevSub);
      endTracking(this);
    }
  }

  // Expose lifecycle state as readonly properties
  get _listenerCount(): number {
    return this.__listenerCount;
  }

  get _isMounted(): boolean {
    return this.__isMounted;
  }

  // Register a mount callback
  onMount(callback: MountCallback): () => void {
    if (typeof callback !== "function") {
      throw new TypeError("Mount callback must be a function");
    }

    // Add callback to the set
    this._mountCallbacks.add(callback);

    // If already mounted, execute the callback immediately
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

    // Return unsubscribe function
    return () => {
      this._mountCallbacks.delete(callback);
    };
  }

  // Track a new subscriber
  private _trackSubscriber(subscriber: Subscriber): void {
    if (!this._trackedSubscribers.has(subscriber)) {
      this._trackedSubscribers.add(subscriber);
      this.__listenerCount++;

      // Cancel any pending unmount
      if (this._unmountTimer) {
        clearTimeout(this._unmountTimer);
        this._unmountTimer = undefined;
      }

      // Trigger mount when first subscriber is added
      if (this.__listenerCount === 1 && !this.__isMounted) {
        this._mount();
      }
    }
  }

  // Untrack a subscriber
  // @ts-ignore - Used externally by reactive system
  private _untrackSubscriber(subscriber: Subscriber): void {
    if (this._trackedSubscribers.has(subscriber)) {
      this._trackedSubscribers.delete(subscriber);
      this.__listenerCount--;

      // Trigger delayed unmount when last subscriber is removed
      if (this.__listenerCount === 0 && this.__isMounted) {
        this._scheduleUnmount();
      }
    }
  }

  // Schedule delayed unmount
  private _scheduleUnmount(): void {
    try {
      if (this._unmountTimer) {
        clearTimeout(this._unmountTimer);
      }

      // Capture current dependencies before they might be cleared
      this._capturedDependencies = new Set();
      let link = this.deps;
      while (link !== undefined) {
        if (link.dep && "_untrackSubscriber" in link.dep) {
          this._capturedDependencies.add(link.dep);
        }
        link = link.nextDep;
      }

      this._unmountTimer = setTimeout(() => {
        if (this.__listenerCount === 0) {
          this._unmount();
        }
      }, 1000);
    } catch (error) {
      console.error("Timer scheduling error:", error);
      // Fallback to immediate unmount
      if (this.__listenerCount === 0) {
        this._unmount();
      }
    }
  }

  // Execute mount callbacks
  private _mount(): void {
    this.__isMounted = true;

    // Execute all mount callbacks and collect cleanup functions
    for (const callback of this._mountCallbacks) {
      try {
        const cleanup = callback();
        if (typeof cleanup === "function") {
          this._cleanupFunctions.add(cleanup);
        }
      } catch (error) {
        console.error("Mount callback error:", error);
        // Continue with other callbacks
      }
    }
  }

  // Execute cleanup functions and unmount
  private _unmount(): void {
    // Clear the unmount timer if it exists
    if (this._unmountTimer) {
      clearTimeout(this._unmountTimer);
      this._unmountTimer = undefined;
    }

    // Use captured dependencies if available, otherwise use current deps
    if (this._capturedDependencies && this._capturedDependencies.size > 0) {
      for (const dep of this._capturedDependencies) {
        if (typeof dep._untrackSubscriber === "function") {
          dep._untrackSubscriber(this);
        }
      }
      this._capturedDependencies.clear();
    } else {
      // Fallback to current dependencies
      let link = this.deps;
      while (link !== undefined) {
        const dep = link.dep;
        // Check if dependency has lifecycle capabilities
        if (
          dep &&
          "_untrackSubscriber" in dep &&
          typeof dep._untrackSubscriber === "function"
        ) {
          (dep as any)._untrackSubscriber(this);
        }
        link = link.nextDep;
      }
    }

    // Execute all cleanup functions
    for (const cleanup of this._cleanupFunctions) {
      try {
        cleanup();
      } catch (error) {
        console.error("Cleanup function error:", error);
        // Continue with other cleanup functions
      }
    }

    // Clear cleanup functions after execution
    this._cleanupFunctions.clear();

    // Mark as unmounted
    this.__isMounted = false;
  }
}

export function isComputed<T>(value: Computed<T> | any): value is Computed<T> {
  return value instanceof Computed;
}

export function readonly<T extends Signal<any>>(
  signal: T,
): Computed<T["value"]> {
  return computed(() => signal.value);
}

// Public lifecycle API functions

/**
 * Register a mount callback on a computed value
 * The callback will be executed when the computed gains its first subscriber
 * Returns an unsubscribe function
 */
export function onMount<T>(
  store: Computed<T>,
  callback: MountCallback,
): () => void {
  if (!isComputed(store)) {
    throw new TypeError("onMount can only be called on a Computed");
  }
  return store.onMount(callback);
}

/**
 * Register an unmount callback on a computed value
 * The callback will be executed when the computed loses its last subscriber
 * Returns an unsubscribe function
 */
export function onUnmount<T>(
  store: Computed<T>,
  callback: UnmountCallback,
): () => void {
  if (!isComputed(store)) {
    throw new TypeError("onUnmount can only be called on a Computed");
  }

  // Wrap the unmount callback as a mount callback that returns it
  const mountCallback: MountCallback = () => callback;
  return store.onMount(mountCallback);
}

/**
 * Keep a computed value mounted until the returned function is called
 * Useful for preventing unmount during temporary subscriber changes
 */
export function keepMount<T>(store: Computed<T>): () => void {
  if (!isComputed(store)) {
    throw new TypeError("keepMount can only be called on a Computed");
  }

  // Create a dummy effect that keeps the store subscribed
  const keepAlive = effect(() => {
    store.value; // Access value to create dependency
  });

  // Return cleanup function
  return () => {
    keepAlive.stop();
  };
}
