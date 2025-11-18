import {
	type Link,
	ReactiveFlags,
	type ReactiveNode,
	SignalFlags,
	getActiveSubscriber,
	getCurrentCycle,
	hasChanged,
	incrementCycle,
	link,
	setActiveSubscriber,
	shallowPropagate,
	shouldUpdate,
	unlink,
	untracked,
} from "./reactivity";

export interface WritableComputedOptions<T> {
	get: () => T;
	set: (value: T) => void;
}

type ComputedSource<T> = (() => T) | WritableComputedOptions<T>;

const COMPUTED_BRAND = Symbol("sigrea.isComputed");

export class Computed<T = unknown> implements ReactiveNode {
	readonly [SignalFlags.IS_SIGNAL] = true;
	readonly [COMPUTED_BRAND] = true;
	currentValue: T | undefined = undefined;
	subs: Link | undefined = undefined;
	subsTail: Link | undefined = undefined;
	deps: Link | undefined = undefined;
	depsTail: Link | undefined = undefined;
	flags: ReactiveFlags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
	private readonly setter?: (value: T) => void;
	public getter: () => T;
	private initialized = false;

	constructor(source: ComputedSource<T>) {
		if (typeof source === "function") {
			this.getter = source;
			this.setter = undefined;
		} else {
			this.getter = source.get;
			this.setter = source.set;
		}
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
		const value = this.currentValue;
		if (!this.initialized) {
			throw new Error("Computed value accessed before initialization.");
		}
		return value as T;
	}

	get value(): T {
		return this.get();
	}

	set value(next: T) {
		if (this.setter === undefined) {
			throw new TypeError("Cannot assign to a readonly computed value.");
		}
		this.setter(next);
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
			this.initialized = true;
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

export function computed<T>(getter: () => T): Computed<T>;
export function computed<T>(options: WritableComputedOptions<T>): Computed<T>;
export function computed<T>(source: ComputedSource<T>): Computed<T> {
	return new Computed(source);
}

export function isComputed<T>(value: unknown): value is Computed<T> {
	return Boolean(
		value &&
			(typeof value === "object" || typeof value === "function") &&
			(value as Record<PropertyKey, unknown>)[COMPUTED_BRAND] === true,
	);
}
