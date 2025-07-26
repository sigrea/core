/**
 * Dependency Tracking Enhancement Module
 *
 * This module enhances the core dependency tracking system with lifecycle support.
 * It wraps the original link and endTracking functions to detect when dependencies
 * are removed and notify them for cleanup purposes.
 *
 * The module maintains a WeakMap of subscriber dependencies to detect removals
 * after endTracking completes. When a dependency is no longer tracked, it notifies
 * the dependency via the _untrackSubscriber method, enabling proper lifecycle cleanup.
 */

import type { Dependency, Subscriber } from "../core";
import { reactiveSystem } from "../core";

const { link: originalLink, endTracking: originalEndTracking } = reactiveSystem;

// Track deps to detect removals after endTracking
const subscriberDeps = new WeakMap<Subscriber, Set<Dependency>>();

export function link(dep: Dependency, sub: Subscriber): void {
  originalLink(dep, sub);
}

export function endTracking(sub: Subscriber): void {
  const currentDeps = new Set<Dependency>();
  let link = sub.deps;
  while (link !== undefined) {
    currentDeps.add(link.dep);
    link = link.nextDep;
  }

  originalEndTracking(sub);

  const newDeps = new Set<Dependency>();
  link = sub.deps;
  while (link !== undefined) {
    newDeps.add(link.dep);
    link = link.nextDep;
  }

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

  if (newDeps.size > 0) {
    subscriberDeps.set(sub, newDeps);
  } else {
    subscriberDeps.delete(sub);
  }
}
