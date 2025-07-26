// Export core types and functions
export type { Dependency, Link, Subscriber } from "./core";
export {
  SubscriberFlags,
  propagate,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
} from "./core";

// Export tracking functions
export { link, endTracking } from "./tracking";

// Export active subscriber management
export { activeSub, setActiveSub, getActiveSub } from "./activeSub";

// Export batch depth management
export {
  incrementBatchDepth,
  decrementBatchDepth,
  getBatchDepth,
} from "./batch";
