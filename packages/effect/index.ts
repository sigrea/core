import type { Link, Subscriber } from "../reactive-system";
import {
	SubscriberFlags,
	endTracking,
	getActiveSub,
	setActiveSub,
	startTracking,
	updateDirtyFlag,
} from "../reactive-system";

type UntrackableDependency = {
	_untrackSubscriber: (subscriber: Subscriber) => void;
};

type DependencyLink = Link & {
	dep: Link["dep"] & Partial<UntrackableDependency>;
};

export function effect<T>(fn: () => T): Effect<T> {
	const instance = new Effect(fn);
	instance.run();
	return instance;
}

export class Effect<T = unknown> implements Subscriber {
	deps: Link | undefined = undefined;

	depsTail: Link | undefined = undefined;

	flags: SubscriberFlags = SubscriberFlags.Effect;

	constructor(public readonly fn: () => T) {}

	notify(): void {
		const flags = this.flags;
		if (
			flags & SubscriberFlags.Dirty ||
			(flags & SubscriberFlags.PendingComputed && updateDirtyFlag(this, flags))
		) {
			this.run();
		}
	}

	run(): T {
		const previous = getActiveSub();
		setActiveSub(this);
		startTracking(this);
		try {
			return this.fn();
		} finally {
			setActiveSub(previous);
			endTracking(this);
		}
	}

	stop(): void {
		let link = this.deps as DependencyLink | undefined;
		while (link !== undefined) {
			const { dep } = link;
			if (dep && typeof dep._untrackSubscriber === "function") {
				dep._untrackSubscriber(this);
			}
			link = link.nextDep as DependencyLink | undefined;
		}

		startTracking(this);
		endTracking(this);

		// Reset flags so pending notifications do not reschedule this effect.
		this.flags = SubscriberFlags.Effect;
	}
}
