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

const {
  link: originalLink,
  propagate,
  endTracking: originalEndTracking,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
} = reactiveSystem;

// Export propagate and other functions as-is
export {
  propagate,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
};

// Enhanced link function with lifecycle tracking
export function link(dep: Dependency, sub: Subscriber): void {
  originalLink(dep, sub);
}

// Store to track dependencies before endTracking
const subscriberDeps = new WeakMap<Subscriber, Set<Dependency>>();

// Enhanced endTracking function with lifecycle cleanup
export function endTracking(sub: Subscriber): void {
  // Store current dependencies before they're cleared
  const currentDeps = new Set<Dependency>();
  let link = sub.deps;
  while (link !== undefined) {
    currentDeps.add(link.dep);
    link = link.nextDep;
  }

  originalEndTracking(sub);

  // After endTracking, check which dependencies were removed
  const newDeps = new Set<Dependency>();
  link = sub.deps;
  while (link !== undefined) {
    newDeps.add(link.dep);
    link = link.nextDep;
  }

  // Notify removed dependencies
  const prevDeps = subscriberDeps.get(sub);
  if (prevDeps) {
    for (const dep of prevDeps) {
      if (
        !newDeps.has(dep) &&
        dep &&
        "_untrackSubscriber" in dep &&
        typeof dep._untrackSubscriber === "function"
      ) {
        (dep as any)._untrackSubscriber(sub);
      }
    }
  }

  // Update stored dependencies
  if (newDeps.size > 0) {
    subscriberDeps.set(sub, newDeps);
  } else {
    subscriberDeps.delete(sub);
  }
}

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
