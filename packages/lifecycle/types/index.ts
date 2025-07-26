// Lifecycle types and interfaces

export type MountCallback = () => (() => void) | undefined | void;
export type UnmountCallback = () => void;

export interface LifecycleCapable {
  // Core lifecycle management
  onMount(callback: MountCallback): () => void;

  // Internal state (not exposed in public API)
  readonly _listenerCount: number;
  readonly _isMounted: boolean;
}

// Type guard for lifecycle-capable stores
export function isLifecycleCapable(value: any): value is LifecycleCapable {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.onMount === "function" &&
    typeof value._listenerCount === "number" &&
    typeof value._isMounted === "boolean"
  );
}
