import type { Computed } from "../../computed";
import { isComputed, onMount as onMountComputed } from "../../computed";
import type { Signal } from "../../signal";
import { isSignal, onMount as onMountSignal } from "../../signal";
import type { MountCallback } from "../types";

/**
 * Executes callback when store gains its first subscriber
 * @param store - Signal or Computed to monitor
 * @param callback - Function to execute on mount (can return cleanup)
 * @returns Unsubscribe function
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
