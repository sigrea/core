/**
 * Internal reactive primitives adapted from alien-deepsignals v0.2.7 (MIT).
 * Source: https://github.com/CCherry07/alien-deepsignals
 */

import {
	createReactiveSystem,
	ReactiveFlags,
	type Link,
	type ReactiveNode,
} from "alien-signals/system";

import type { Computed } from "./computed";
import type { Signal } from "./signal";

export { ReactiveFlags };
export type { Link, ReactiveNode };

export const enum SignalFlags {
	IS_SIGNAL = "__v_isSignal",
	SKIP = "__v_skip",
}

const {
	link,
	unlink,
	propagate,
	checkDirty,
	shallowPropagate,
} = createReactiveSystem({
	update(node: ReactiveNode & { update(): boolean }) {
		return node.update();
	},
	notify(effect: Effect) {
		queue.push(effect);
	},
	unwatched() {},
});

export { link, unlink, propagate, shallowPropagate };

let cycle = 0;
let batchDepth = 0;
let activeSub: ReactiveNode | undefined;

const queue: Effect[] = [];
const pauseStack: Array<ReactiveNode | undefined> = [];

export function pauseTracking(): void {
	pauseStack.push(activeSub);
	activeSub = undefined;
}

export function resumeTracking(): void {
	activeSub = pauseStack.pop();
}

export const untracked = <T>(fn: () => T): T => {
	pauseTracking();
	try {
		return fn();
	} finally {
		resumeTracking();
	}
};

export function getCurrentCycle(): number {
	return cycle;
}

export function incrementCycle(): number {
	cycle += 1;
	return cycle;
}

export function getActiveSubscriber(): ReactiveNode | undefined {
	return activeSub;
}

export function setActiveSubscriber(node: ReactiveNode | undefined): void {
	activeSub = node;
}

export function startBatch(): void {
	batchDepth += 1;
}

export function endBatch(): void {
	batchDepth -= 1;
	if (batchDepth === 0) {
		flush();
	}
}

export function isBatching(): boolean {
	return batchDepth > 0;
}

export function batch<T>(fn: () => T): T {
	startBatch();
	try {
		return fn();
	} finally {
		endBatch();
	}
}

function flush(): void {
	while (queue.length > 0) {
		queue.shift()!.scheduler();
	}
}

export function flushSchedulerQueue(): void {
	flush();
}

export function shouldUpdate(node: ReactiveNode): boolean {
	const { flags } = node;
	if (flags & ReactiveFlags.Dirty) {
		return true;
	}
	if (flags & ReactiveFlags.Pending) {
		if (checkDirty(node.deps!, node)) {
			return true;
		}
		node.flags = flags & ~ReactiveFlags.Pending;
	}
	return false;
}

export class Effect<T = any> implements ReactiveNode {
	deps: Link | undefined = undefined;
	depsTail: Link | undefined = undefined;
	flags: ReactiveFlags = ReactiveFlags.Watching;

	constructor(public fn: () => T) {}

	run(): T {
		incrementCycle();
		this.depsTail = undefined;
		this.flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
		const previous = getActiveSubscriber();
		setActiveSubscriber(this);
		try {
			return this.fn();
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

	scheduler(immediateFirstRun?: boolean): void {
		if (!immediateFirstRun && !this.shouldUpdate) {
			return;
		}
		if (this.shouldUpdate) {
			this.run();
		}
	}

	get shouldUpdate(): boolean {
		return shouldUpdate(this);
	}

	stop(): void {
		let dep = this.deps;
		while (dep !== undefined) {
			dep = unlink(dep, this);
		}
	}

	dirty(): boolean {
		return shouldUpdate(this);
	}
}

export function effect<T>(fn: () => T): Effect<T> {
	const instance = new Effect(fn);
	instance.run();
	return instance;
}

export const objectToString: typeof Object.prototype.toString =
	Object.prototype.toString;

export const toTypeString = (value: unknown): string =>
	objectToString.call(value);

export const isArray: typeof Array.isArray = Array.isArray;

export const isMap = (val: unknown): val is Map<any, any> =>
	toTypeString(val) === "[object Map]";

export const isSet = (val: unknown): val is Set<any> =>
	toTypeString(val) === "[object Set]";

export const isDate = (val: unknown): val is Date =>
	toTypeString(val) === "[object Date]";

export const isRegExp = (val: unknown): val is RegExp =>
	toTypeString(val) === "[object RegExp]";

export const isFunction = (val: unknown): val is Function =>
	typeof val === "function";

export const isString = (val: unknown): val is string =>
	typeof val === "string";

export const isSymbol = (val: unknown): val is symbol =>
	typeof val === "symbol";

export const isObject = (val: unknown): val is Record<any, any> =>
	val !== null && typeof val === "object";

export const isPromise = <T = any>(val: unknown): val is Promise<T> =>
	(isObject(val) || isFunction(val)) &&
	isFunction((val as any).then) &&
	isFunction((val as any).catch);

export const isPlainObject = (val: unknown): val is object =>
	toTypeString(val) === "[object Object]";

export const hasChanged = (value: unknown, oldValue: unknown): boolean =>
	!Object.is(value, oldValue);

export function NOOP(): void {}

export function isSignal<T>(
	source: Signal<T> | unknown,
): source is Signal<T> {
	return source
		? (source as Record<string, unknown>)[SignalFlags.IS_SIGNAL] === true
		: false;
}

export type MaybeSignal<T = any> = T | Signal<T>;

export type MaybeSignalOrGetter<T = any> =
	| MaybeSignal<T>
	| Computed<T>
	| (() => T);

export function unSignal<T>(
	source: MaybeSignal<T> | Computed<T>,
): T {
	return (isSignal(source) ? source.value : source) as T;
}

export function toValue<T>(source: MaybeSignalOrGetter<T>): T {
	return isFunction(source) ? source() : unSignal(source);
}
