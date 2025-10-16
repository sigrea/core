import type { Dependency, Link, Subscriber } from "../core";
import { reactiveSystem } from "../core";

const { link: originalLink, endTracking: originalEndTracking } = reactiveSystem;

const subscriberDeps = new WeakMap<Subscriber, Set<Dependency>>();

type UntrackableDependency = Dependency & {
	_untrackSubscriber?: (sub: Subscriber) => void;
};

function hasUntrackSubscriber(dep: Dependency): dep is UntrackableDependency {
	return (
		typeof (dep as UntrackableDependency)._untrackSubscriber === "function"
	);
}

export function link(dep: Dependency, sub: Subscriber): Link | undefined {
	return originalLink(dep, sub);
}

export function endTracking(sub: Subscriber): void {
	originalEndTracking(sub);

	const nextDeps = collectDeps(sub);

	const prevDeps = subscriberDeps.get(sub);
	if (prevDeps !== undefined) {
		for (const dep of prevDeps) {
			if (!nextDeps.has(dep) && hasUntrackSubscriber(dep)) {
				dep._untrackSubscriber(sub);
			}
		}
	}

	if (nextDeps.size > 0) {
		subscriberDeps.set(sub, nextDeps);
	} else {
		subscriberDeps.delete(sub);
	}
}

function collectDeps(sub: Subscriber): Set<Dependency> {
	const deps = new Set<Dependency>();
	let link = sub.deps;
	while (link !== undefined) {
		deps.add(link.dep);
		link = link.nextDep;
	}
	return deps;
}
