import {
	SignalFlags,
	ReactiveFlags,
	type Link,
	type ReactiveNode,
	getActiveSubscriber,
	getCurrentCycle,
	incrementCycle,
	hasChanged,
	link,
	setActiveSubscriber,
	shouldUpdate,
	shallowPropagate,
	unlink,
	untracked,
} from "./reactivity";

export class Computed<T = any> implements ReactiveNode {
	readonly [SignalFlags.IS_SIGNAL] = true;
	currentValue: T | undefined = undefined;
	subs: Link | undefined = undefined;
	subsTail: Link | undefined = undefined;
	deps: Link | undefined = undefined;
	depsTail: Link | undefined = undefined;
	flags: ReactiveFlags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;

	constructor(public getter: () => T) {}

	get(): T {
		if (shouldUpdate(this) && this.update()) {
			const subs = this.subs;
			if (subs !== undefined) {
				shallowPropagate(subs);
			}
		}
		const subscriber = getActiveSubscriber();
		if (subscriber !== undefined) {
			link(this, subscriber, getCurrentCycle());
		}
		return this.currentValue!;
	}

	get value(): T {
		return this.get();
	}

	peek(): T {
		return untracked(this.getter);
	}

	update(): boolean {
		incrementCycle();
		this.depsTail = undefined;
		this.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
		const previous = getActiveSubscriber();
		setActiveSubscriber(this);
		try {
			const nextValue = this.getter();
			const changed = hasChanged(this.currentValue, nextValue);
			this.currentValue = nextValue;
			return changed;
		} finally {
			setActiveSubscriber(previous);
			this.flags &= ~ReactiveFlags.RecursedCheck;
			let toRemove =
				this.depsTail !== undefined
					? (this.depsTail as Link).nextDep
					: this.deps;
			while (toRemove !== undefined) {
				toRemove = unlink(toRemove, this);
			}
		}
	}
}

export function computed<T>(getter: () => T): Computed<T> {
	return new Computed(getter);
}
