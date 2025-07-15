import {
  type Dependency,
  type Link,
  type Subscriber,
  SubscriberFlags,
  createReactiveSystem,
} from "alien-signals";

export type { Dependency, Link, Subscriber };
export { SubscriberFlags };

// Create the reactive system
const reactiveSystem = createReactiveSystem({
  updateComputed(computed: any) {
    return computed.update();
  },
  notifyEffect(effect: any) {
    effect.notify();
    return true;
  },
});

export const {
  link,
  propagate,
  endTracking,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
} = reactiveSystem;

// Global active subscriber
export let activeSub: Subscriber | undefined = undefined;

export function setActiveSub(sub: Subscriber | undefined): void {
  activeSub = sub;
}

export function getActiveSub(): Subscriber | undefined {
  return activeSub;
}

// Batch depth tracking
let batchDepth = 0;

export function incrementBatchDepth(): void {
  ++batchDepth;
}

export function decrementBatchDepth(): number {
  return --batchDepth;
}

export function getBatchDepth(): number {
  return batchDepth;
}
