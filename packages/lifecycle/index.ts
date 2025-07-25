// Export lifecycle types
export type { LifecycleCapable, MountCallback, UnmountCallback } from "./types";
export { isLifecycleCapable } from "./types";

// Export unified lifecycle API
export { onMount, onUnmount, keepMount } from "./api";
