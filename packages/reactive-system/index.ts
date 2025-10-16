export type { Dependency, Link, Subscriber } from "./core";
export {
	SubscriberFlags,
	propagate,
	startTracking,
	updateDirtyFlag,
	processComputedUpdate,
	processEffectNotifications,
} from "./core";

export { link, endTracking } from "./tracking";

export { activeSub, setActiveSub, getActiveSub } from "./activeSub";

export {
	incrementBatchDepth,
	decrementBatchDepth,
	getBatchDepth,
} from "./batch";
