/**
 * Core Reactive System Module
 *
 * This module wraps the alien-signals library to provide the foundational
 * reactive system capabilities. It creates and configures the reactive system
 * with custom update and notification strategies.
 *
 * The reactive system manages the relationships between dependencies (reactive values)
 * and subscribers (computed values and effects), handling automatic dependency tracking,
 * update propagation, and effect scheduling.
 */

import {
  type Dependency,
  type Link,
  type Subscriber,
  SubscriberFlags,
  createReactiveSystem,
} from "alien-signals";

export type { Dependency, Link, Subscriber };
export { SubscriberFlags };

export const reactiveSystem = createReactiveSystem({
  updateComputed(computed: any) {
    return computed.update();
  },
  notifyEffect(effect: any) {
    effect.notify();
    return true;
  },
});

export const {
  propagate,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
} = reactiveSystem;
