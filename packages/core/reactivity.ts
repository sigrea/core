/**
 * Internal reactive primitives adapted from alien-deepsignals v0.2.7 (MIT).
 * Source: https://github.com/CCherry07/alien-deepsignals
 */

import {
	type Link,
	ReactiveFlags,
	type ReactiveNode,
	createReactiveSystem,
} from "alien-signals/system";

import type { Computed } from "./computed";
import type { Signal } from "./signal";
import type { SignalNode } from "./signal";

export { ReactiveFlags };
export type { Link, ReactiveNode };

export enum SignalFlags {
	IS_SIGNAL = "__v_isSignal",
	SKIP = "__v_skip",
}

export enum TrackOpType {
	GET = "get",
	HAS = "has",
	ITERATE = "iterate",
}

export enum TriggerOpType {
	SET = "set",
	ADD = "add",
	DELETE = "delete",
	CLEAR = "clear",
}

export type Dep = SignalNode<number>;

export interface DebuggerEventExtraInfo {
	target: object;
	type: TrackOpType | TriggerOpType;
	key?: unknown;
	newValue?: unknown;
}

export interface DebuggerEvent extends DebuggerEventExtraInfo {
	effect: ReactiveNode;
}

export type DebuggerHook = (event: DebuggerEvent) => void;

type DepFactory = () => Dep;
type DepsMap = Map<unknown, Dep>;

const targetMap = new WeakMap<object, DepsMap>();
export const ITERATE_KEY = Symbol("sigrea.iterate");
export const MAP_KEY_ITERATE_KEY = Symbol("sigrea.map_key_iterate");

let createDep: DepFactory | undefined;

export function setDepFactory(factory: DepFactory): void {
	createDep = factory;
}

function createDepsMap(target: object): DepsMap {
	let depsMap = targetMap.get(target);
	if (depsMap === undefined) {
		depsMap = new Map();
		targetMap.set(target, depsMap);
	}
	return depsMap;
}

function getDepFromMap(depsMap: DepsMap, key: unknown): Dep | undefined {
	let dep = depsMap.get(key);
	if (dep === undefined) {
		if (createDep === undefined) {
			return undefined;
		}
		dep = createDep();
		depsMap.set(key, dep);
	}
	return dep;
}

type DebuggableNode = ReactiveNode & {
	onTrack?: DebuggerHook;
	onTrigger?: DebuggerHook;
};

function hasDebuggerHooks(node: ReactiveNode): node is DebuggableNode {
	const candidate = node as DebuggableNode;
	return (
		typeof candidate.onTrack === "function" ||
		typeof candidate.onTrigger === "function"
	);
}

function computeTrackKey(
	target: object,
	type: TrackOpType,
	key: unknown,
): unknown {
	if (type === TrackOpType.ITERATE) {
		if (key !== undefined) {
			return key;
		}
		return isArray(target) ? "length" : ITERATE_KEY;
	}
	if (key === undefined) {
		return undefined;
	}
	return key as PropertyKey;
}

export function track(target: object, type: TrackOpType, key?: unknown): void {
	if (createDep === undefined) {
		return;
	}
	const active = getActiveSubscriber();
	if (active === undefined) {
		return;
	}
	const depKey = computeTrackKey(target, type, key);
	if (depKey === undefined) {
		return;
	}
	const dep = getDepFromMap(createDepsMap(target), depKey);
	dep?.get();
	if (hasDebuggerHooks(active) && active.onTrack !== undefined) {
		active.onTrack({
			effect: active,
			target,
			type,
			key,
		});
	}
}

function collectSubscribers(dep: Dep, effects: Set<ReactiveNode>): void {
	let link = dep.subs;
	while (link !== undefined) {
		effects.add(link.sub);
		link = link.nextSub;
	}
}

function queueDep(
	deps: Set<Dep>,
	effects: Set<ReactiveNode>,
	dep: Dep | undefined,
): void {
	if (dep === undefined || deps.has(dep)) {
		return;
	}
	deps.add(dep);
	collectSubscribers(dep, effects);
}

function triggerDebuggerHooks(
	effects: Set<ReactiveNode>,
	info: DebuggerEventExtraInfo,
): void {
	for (const node of effects) {
		if (!hasDebuggerHooks(node) || node.onTrigger === undefined) {
			continue;
		}
		node.onTrigger({
			effect: node,
			...info,
		});
	}
}

function triggerEffects(effects: Set<Dep>): void {
	for (const dep of effects) {
		dep.set(dep.peek() + 1);
	}
}

export function trigger(
	target: object,
	type: TriggerOpType,
	key?: unknown,
	newValue?: unknown,
): void {
	const depsMap = targetMap.get(target);
	if (depsMap === undefined) {
		return;
	}
	const depsToTrigger = new Set<Dep>();
	const effects = new Set<ReactiveNode>();
	if (type === TriggerOpType.CLEAR) {
		for (const dep of depsMap.values()) {
			queueDep(depsToTrigger, effects, dep);
		}
	} else if (
		type === TriggerOpType.SET &&
		isArray(target) &&
		key === "length"
	) {
		const newLength = Number(newValue);
		for (const [depKey, dep] of depsMap.entries()) {
			if (
				depKey === "length" ||
				(isIntegerKey(depKey) && Number(depKey) >= newLength)
			) {
				queueDep(depsToTrigger, effects, dep);
			}
		}
	} else if (key !== undefined) {
		queueDep(depsToTrigger, effects, depsMap.get(key));
	}

	if (type === TriggerOpType.ADD || type === TriggerOpType.DELETE) {
		if (!isArray(target)) {
			queueDep(depsToTrigger, effects, depsMap.get(ITERATE_KEY));
			if (isMap(target)) {
				queueDep(depsToTrigger, effects, depsMap.get(MAP_KEY_ITERATE_KEY));
			}
		} else if (isIntegerKey(key)) {
			queueDep(depsToTrigger, effects, depsMap.get("length"));
		}
	}
	if (type === TriggerOpType.SET && isMap(target)) {
		queueDep(depsToTrigger, effects, depsMap.get(ITERATE_KEY));
	}
	if (effects.size > 0) {
		triggerDebuggerHooks(effects, {
			target,
			type,
			key,
			newValue,
		});
	}
	triggerEffects(depsToTrigger);
}

const { link, unlink, propagate, checkDirty, shallowPropagate } =
	createReactiveSystem({
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
		const effect = queue.shift();
		if (effect !== undefined) {
			effect.scheduler();
		}
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
		const deps = node.deps;
		if (deps !== undefined && checkDirty(deps, node)) {
			return true;
		}
		node.flags = flags & ~ReactiveFlags.Pending;
	}
	return false;
}

export class Effect<T = unknown> implements ReactiveNode {
	deps: Link | undefined = undefined;
	depsTail: Link | undefined = undefined;
	flags: ReactiveFlags = ReactiveFlags.Watching;
	onTrack?: DebuggerHook;
	onTrigger?: DebuggerHook;

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

export const isMap = (val: unknown): val is Map<unknown, unknown> =>
	toTypeString(val) === "[object Map]";

export const isSet = (val: unknown): val is Set<unknown> =>
	toTypeString(val) === "[object Set]";

export const isWeakMap = (val: unknown): val is WeakMap<object, unknown> =>
	toTypeString(val) === "[object WeakMap]";

export const isWeakSet = (val: unknown): val is WeakSet<object> =>
	toTypeString(val) === "[object WeakSet]";

export const isDate = (val: unknown): val is Date =>
	toTypeString(val) === "[object Date]";

export const isRegExp = (val: unknown): val is RegExp =>
	toTypeString(val) === "[object RegExp]";

export const isFunction = (
	val: unknown,
): val is (...args: unknown[]) => unknown => typeof val === "function";

export const isString = (val: unknown): val is string =>
	typeof val === "string";

export const isSymbol = (val: unknown): val is symbol =>
	typeof val === "symbol";

export const isIntegerKey = (key: unknown): key is string =>
	typeof key === "string" &&
	key !== "NaN" &&
	key !== "Infinity" &&
	String(Number(key)) === key &&
	Number(key) >= 0;

const hasDataView = typeof DataView !== "undefined";

const isDataView = (val: unknown): val is DataView =>
	hasDataView && val instanceof DataView;

export type TypedArray = Exclude<ArrayBufferView, DataView>;

export const isTypedArray = (val: unknown): val is TypedArray =>
	ArrayBuffer.isView(val) && !isDataView(val);

export const isObject = (val: unknown): val is Record<PropertyKey, unknown> =>
	val !== null && typeof val === "object";

type PromiseCandidate = {
	then?: unknown;
	catch?: unknown;
};

export const isPromise = <T = unknown>(val: unknown): val is Promise<T> => {
	if (!isObject(val) && !isFunction(val)) {
		return false;
	}
	const candidate = val as PromiseCandidate;
	return isFunction(candidate.then) && isFunction(candidate.catch);
};

export const isPlainObject = (val: unknown): val is object =>
	toTypeString(val) === "[object Object]";

export const hasChanged = (value: unknown, oldValue: unknown): boolean =>
	!Object.is(value, oldValue);

export function NOOP(): void {}

export function isSignal<T>(source: Signal<T> | unknown): source is Signal<T> {
	return source
		? (source as Record<string, unknown>)[SignalFlags.IS_SIGNAL] === true
		: false;
}

export type MaybeSignal<T = unknown> = T | Signal<T>;

export type MaybeSignalOrGetter<T = unknown> =
	| MaybeSignal<T>
	| Computed<T>
	| (() => T);

export function unSignal<T>(source: MaybeSignal<T> | Computed<T>): T {
	return (isSignal(source) ? source.value : source) as T;
}

export function toValue<T>(source: MaybeSignalOrGetter<T>): T {
	return isFunction(source) ? source() : unSignal(source);
}
