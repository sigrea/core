import type { Computed } from "../../computed";
import { isComputed, keepMount as keepMountComputed } from "../../computed";
import type { Signal } from "../../signal";
import { isSignal, keepMount as keepMountSignal } from "../../signal";

/**
 * Prevents unmount when subscribers temporarily disconnect
 * @param store - Signal or Computed to keep mounted
 * @returns Release function
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
