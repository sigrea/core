import {
	SignalFlags,
	ReactiveFlags,
	type Link,
	type ReactiveNode,
	flushSchedulerQueue,
	getActiveSubscriber,
	getCurrentCycle,
	hasChanged,
	isBatching,
	link,
	propagate,
	shouldUpdate,
	shallowPropagate,
} from "./reactivity";

export class SignalNode<T = any> implements ReactiveNode {
	readonly [SignalFlags.IS_SIGNAL] = true;
	subs: Link | undefined = undefined;
	subsTail: Link | undefined = undefined;
	flags: ReactiveFlags = ReactiveFlags.Mutable;
	currentValue: T;
	private pendingValue: T;

	constructor(value: T) {
		this.pendingValue = this.currentValue = value;
	}

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
		return this.currentValue;
	}

	set(value: T): void {
		this.pendingValue = value;
		this.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
		const subs = this.subs;
		if (subs !== undefined) {
			propagate(subs);
			if (!isBatching()) {
				flushSchedulerQueue();
			}
		}
	}

	update(): boolean {
		this.flags = ReactiveFlags.Mutable;
		const nextValue = this.pendingValue;
		const changed = hasChanged(this.currentValue, nextValue);
		this.currentValue = nextValue;
		return changed;
	}

	get value(): T {
		return this.get();
	}

	set value(next: T) {
		this.set(next);
	}

	peek(): T {
		return this.pendingValue;
	}
}

export type Signal<T> = Pick<SignalNode<T>, "value" | "peek">;

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(value: T): Signal<T>;
export function signal<T>(value?: T): Signal<T | undefined> {
	return new SignalNode(value as T) as Signal<T | undefined>;
}
