import type { Computed } from "../computed";
import {
  isComputed,
  keepMount as keepMountComputed,
  onMount as onMountComputed,
  onUnmount as onUnmountComputed,
} from "../computed";
import type { Signal } from "../signal";
import {
  isSignal,
  keepMount as keepMountSignal,
  onMount as onMountSignal,
  onUnmount as onUnmountSignal,
} from "../signal";
import type { MountCallback, UnmountCallback } from "./types";

/**
 * Register a mount callback on a reactive store (Signal or Computed)
 * The callback will be executed when the store gains its first subscriber
 *
 * @param store - The Signal or Computed to monitor
 * @param callback - Function to execute on mount. Can return a cleanup function.
 * @returns Unsubscribe function to remove the callback
 *
 * @example
 * const userId = signal(1);
 *
 * onMount(userId, () => {
 *   console.log('User ID signal is now being used');
 *
 *   // Optional: return cleanup function
 *   return () => {
 *     console.log('Cleaning up user ID signal');
 *   };
 * });
 */
export function onMount<T>(
  store: Signal<T> | Computed<T>,
  callback: MountCallback,
): () => void {
  if (isSignal(store)) {
    return onMountSignal(store, callback);
  }
  if (isComputed(store)) {
    return onMountComputed(store, callback);
  }
  throw new TypeError(
    `onMount can only be called on a Signal or Computed instance. Received: ${store === null ? "null" : typeof store}`,
  );
}

/**
 * Register an unmount callback on a reactive store (Signal or Computed)
 * The callback will be executed when the store loses its last subscriber (after 1 second delay)
 *
 * @param store - The Signal or Computed to monitor
 * @param callback - Function to execute on unmount
 * @returns Unsubscribe function to remove the callback
 *
 * @example
 * const connection = signal(null);
 *
 * onUnmount(connection, () => {
 *   console.log('Closing connection...');
 *   // Cleanup resources
 * });
 */
export function onUnmount<T>(
  store: Signal<T> | Computed<T>,
  callback: UnmountCallback,
): () => void {
  if (isSignal(store)) {
    return onUnmountSignal(store, callback);
  }
  if (isComputed(store)) {
    return onUnmountComputed(store, callback);
  }
  throw new TypeError(
    `onUnmount can only be called on a Signal or Computed instance. Received: ${store === null ? "null" : typeof store}`,
  );
}

/**
 * Keep a reactive store (Signal or Computed) mounted until the returned function is called
 * Useful for preventing unmount during temporary subscriber changes
 *
 * @param store - The Signal or Computed to keep mounted
 * @returns Cleanup function to release the mount
 *
 * @example
 * const data = signal(null);
 *
 * // Keep data signal mounted during async operation
 * const release = keepMount(data);
 *
 * try {
 *   await someAsyncOperation();
 * } finally {
 *   release(); // Allow normal unmount behavior
 * }
 */
export function keepMount<T>(store: Signal<T> | Computed<T>): () => void {
  if (isSignal(store)) {
    return keepMountSignal(store);
  }
  if (isComputed(store)) {
    return keepMountComputed(store);
  }
  throw new TypeError(
    `keepMount can only be called on a Signal or Computed instance. Received: ${store === null ? "null" : typeof store}`,
  );
}
