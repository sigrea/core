import type { Computed } from "../../computed";
import { isComputed, onUnmount as onUnmountComputed } from "../../computed";
import type { Signal } from "../../signal";
import { isSignal, onUnmount as onUnmountSignal } from "../../signal";
import type { UnmountCallback } from "../types";

/**
 * Executes callback 1 second after store loses its last subscriber
 * @param store - Signal or Computed to monitor
 * @param callback - Function to execute on unmount
 * @returns Unsubscribe function
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
