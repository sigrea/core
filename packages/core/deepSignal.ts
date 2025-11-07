import {
	getActiveSubscriber,
	getCurrentCycle,
	isArray,
	isObject,
	link,
	pauseTracking,
	resumeTracking,
	type ReactiveNode,
	untracked,
} from "./reactivity";

import { SignalNode } from "./signal";

const RAW_SYMBOL = Symbol("sigrea.raw");
const NODE_SYMBOL = Symbol("sigrea.node");

const rawToNode = new WeakMap<object, DeepSignalNode<any>>();
const proxyToNode = new WeakMap<object, DeepSignalNode<any>>();

const wellKnownSymbols = new Set(
	Object.getOwnPropertyNames(Symbol)
		.map((key) => Symbol[key as keyof typeof Symbol])
		.filter((value): value is symbol => typeof value === "symbol"),
);

const supportedConstructors = new Set<ObjectConstructor | ArrayConstructor>([
	Object,
	Array,
]);

const hasOwn = (target: object, key: PropertyKey): boolean =>
	Object.prototype.hasOwnProperty.call(target, key);

const isIndexKey = (key: PropertyKey): boolean =>
	typeof key === "string" &&
	key !== "NaN" &&
	key !== "Infinity" &&
	String(Number(key)) === key &&
	Number(key) >= 0;

const isObservable = (value: unknown): value is object => {
	if (!isObject(value) || value === null) {
		return false;
	}
	const ctor = (value as { constructor?: unknown }).constructor;
	return (
		typeof ctor === "function" &&
		supportedConstructors.has(ctor as ObjectConstructor | ArrayConstructor)
	);
};

class DeepSignalNode<T extends object> {
	readonly raw: T;
	readonly proxy: DeepSignal<T>;

	private readonly propertySignals = new Map<PropertyKey, SignalNode<any>>();
	private readonly propertySubscribers = new Map<
		PropertyKey,
		WeakMap<ReactiveNode, number>
	>();
	private readonly propertyChildren = new Map<
		PropertyKey,
		DeepSignalNode<any>
	>();
	private readonly parents = new Map<
		DeepSignalNode<any>,
		Set<PropertyKey>
	>();
	private readonly iterationSignal = new SignalNode(0);
	private readonly versionSignal = new SignalNode(0);
	private readonly shallowVersionSignal = new SignalNode(0);

	constructor(raw: T) {
		this.raw = raw;
		rawToNode.set(raw, this);
		this.proxy = new Proxy(raw, this.createHandlers()) as DeepSignal<T>;
		proxyToNode.set(this.proxy as object, this);
	}

	getVersion(): SignalNode<number> {
		return this.versionSignal;
	}

	getShallowVersion(): SignalNode<number> {
		return this.shallowVersionSignal;
	}

	trackIteration(): void {
		this.iterationSignal.get();
	}

	triggerIteration(): void {
		this.iterationSignal.set(this.iterationSignal.peek() + 1);
	}

	private createHandlers(): ProxyHandler<any> {
		return {
			get: (target, key, receiver) => this.handleGet(target, key, receiver),
			set: (target, key, value, receiver) =>
				this.handleSet(target, key, value, receiver),
			deleteProperty: (target, key) => this.handleDelete(target, key),
			has: (target, key) => this.handleHas(target, key),
			ownKeys: (target) => this.handleOwnKeys(target),
			defineProperty: (target, key, descriptor) =>
				this.handleDefineProperty(target, key, descriptor),
			getOwnPropertyDescriptor: (target, key) =>
				Reflect.getOwnPropertyDescriptor(target, key),
		};
	}

	private handleGet(
		target: T,
		key: PropertyKey,
		receiver: unknown,
	): unknown {
		if (key === RAW_SYMBOL) {
			return target;
		}
		if (key === NODE_SYMBOL) {
			return this;
		}
		if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
			if (key === Symbol.iterator) {
				this.trackIteration();
			}
			return Reflect.get(target, key, receiver);
		}

		const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
		if (descriptor?.get !== undefined) {
			return Reflect.get(target, key, receiver);
		}

		if (!hasOwn(target, key)) {
			return Reflect.get(target, key, receiver);
		}

		return this.readProperty(key);
	}

	private handleSet(
		target: T,
		key: PropertyKey,
		value: unknown,
		receiver: unknown,
	): boolean {
		const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
		if (descriptor?.set !== undefined) {
			const setter = descriptor.set as (
				this: unknown,
				newValue: unknown,
			) => void;
			setter.call(receiver, value);
			return true;
		}

		const rawValue = this.unwrap(value);
		const hadKey = hasOwn(target, key);
		const currentRaw = hadKey
			? (target as Record<PropertyKey, unknown>)[key]
			: undefined;
		const result = Reflect.set(target as object, key, rawValue, receiver);
		if (!result) {
			return false;
		}

		const signal = this.ensurePropertySignal(key);
		const previous = signal.peek();
		const nextValue = this.wrapValueForKey(key, rawValue);
		const needsSignalUpdate = !Object.is(previous, nextValue);
		const shouldNotify = !hadKey || !Object.is(currentRaw, rawValue);

		if (needsSignalUpdate) {
			signal.set(nextValue);
		}

		if (!hadKey) {
			this.triggerIteration();
		}

		if (isArray(target)) {
			if (key === "length") {
				this.updateLengthSignal(target.length);
			} else if (!hadKey && isIndexKey(key)) {
				this.updateLengthSignal(target.length);
			}
		}

		if (shouldNotify) {
			this.markVersionChanged();
		}

		return true;
	}

	private handleDelete(target: T, key: PropertyKey): boolean {
		const hadKey = hasOwn(target, key);
		const currentChild = this.propertyChildren.get(key);
		const result = Reflect.deleteProperty(target, key);
		if (!result) {
			return false;
		}
		if (currentChild !== undefined) {
			currentChild.removeParent(this, key);
			this.propertyChildren.delete(key);
		}
		if (hadKey) {
			const signal = this.propertySignals.get(key);
			if (signal !== undefined) {
				signal.set(undefined);
				this.propertySignals.delete(key);
			}
			this.triggerIteration();
			if (isArray(target)) {
				this.updateLengthSignal(target.length);
			}
			this.markVersionChanged();
		}
		return true;
	}

	private handleHas(target: T, key: PropertyKey): boolean {
		if (hasOwn(target, key)) {
			const signal = this.ensurePropertySignal(key);
			signal.get();
		} else {
			this.trackIteration();
		}
		return key in target;
	}

	private handleOwnKeys(target: T): ArrayLike<string | symbol> {
		this.trackIteration();
		const keys = Reflect.ownKeys(target);
		return keys.map((key) =>
			typeof key === "number" ? String(key) : key,
		);
	}

	private handleDefineProperty(
		target: T,
		key: PropertyKey,
		descriptor: PropertyDescriptor,
	): boolean {
		const hadKey = hasOwn(target, key);
		const result = Reflect.defineProperty(target, key, descriptor);
		if (!result) {
			return false;
		}

		let shouldNotify = false;
		if ("value" in descriptor) {
			const rawValue = this.unwrap(descriptor.value);
			const currentRaw = hadKey
				? (target as Record<PropertyKey, unknown>)[key]
				: undefined;
			const signal = this.ensurePropertySignal(key);
			const previous = signal.peek();
			const nextValue = this.wrapValueForKey(key, rawValue);
			const needsSignalUpdate = !Object.is(previous, nextValue);
			if (needsSignalUpdate) {
				signal.set(nextValue);
			}
			if (!hadKey || !Object.is(currentRaw, rawValue)) {
				shouldNotify = true;
			}
		} else if (!hadKey) {
			shouldNotify = true;
		}

		if (isArray(target)) {
			if (key === "length") {
				this.updateLengthSignal(target.length);
			} else if (isIndexKey(key) && shouldNotify) {
				this.updateLengthSignal(target.length);
			}
		}

		if (shouldNotify) {
			this.triggerIteration();
			this.markVersionChanged();
		}

		return true;
	}

	private readProperty(key: PropertyKey): unknown {
		const signal = this.ensurePropertySignal(key);
		const subscriber = getActiveSubscriber();
		if (subscriber === undefined) {
			return signal.get();
		}

		let result: unknown;
		pauseTracking();
		try {
			result = signal.get();
		} finally {
			resumeTracking();
		}

		const cycle = getCurrentCycle();
		const tracker = this.ensureSubscriberTracker(key);
		if (tracker.get(subscriber) !== cycle) {
			tracker.set(subscriber, cycle);
			link(signal, subscriber, cycle);
		}

		return result;
	}

	private ensurePropertySignal(key: PropertyKey): SignalNode<any> {
		let signal = this.propertySignals.get(key);
		if (signal === undefined) {
			const target = this.raw as Record<PropertyKey, unknown>;
			const initial = this.wrapValueForKey(key, target[key]);
			signal = new SignalNode(initial);
			this.propertySignals.set(key, signal);
		}
		return signal;
	}

	private ensureSubscriberTracker(
		key: PropertyKey,
	): WeakMap<ReactiveNode, number> {
		let subscribers = this.propertySubscribers.get(key);
		if (subscribers === undefined) {
			subscribers = new WeakMap();
			this.propertySubscribers.set(key, subscribers);
		}
		return subscribers;
	}

	private wrapValueForKey(key: PropertyKey, value: unknown): unknown {
		const unwrapped = this.unwrap(value);
		if (!isObject(unwrapped) || unwrapped === null || !isObservable(unwrapped)) {
			this.detachChild(key);
			return unwrapped;
		}

		const childNode = getOrCreateNode(unwrapped);
		this.attachChild(key, childNode);
		return childNode.proxy;
	}

	private attachChild(key: PropertyKey, child: DeepSignalNode<any>): void {
		if (child === this) {
			this.propertyChildren.set(key, child);
			return;
		}
		const existing = this.propertyChildren.get(key);
		if (existing !== undefined && existing !== child) {
			existing.removeParent(this, key);
		}
		if (existing !== child) {
			this.propertyChildren.set(key, child);
			child.addParent(this, key);
		}
	}

	private detachChild(key: PropertyKey): void {
		const existing = this.propertyChildren.get(key);
		if (existing !== undefined) {
			if (existing !== this) {
				existing.removeParent(this, key);
			}
			this.propertyChildren.delete(key);
		}
	}

	addParent(parent: DeepSignalNode<any>, key: PropertyKey): void {
		if (parent === this) {
			return;
		}
		let keys = this.parents.get(parent);
		if (keys === undefined) {
			keys = new Set();
			this.parents.set(parent, keys);
		}
		keys.add(key);
	}

	removeParent(parent: DeepSignalNode<any>, key: PropertyKey): void {
		const keys = this.parents.get(parent);
		if (keys === undefined) {
			return;
		}
		keys.delete(key);
		if (keys.size === 0) {
			this.parents.delete(parent);
		}
	}

	private unwrap(value: unknown): unknown {
		if (isObject(value) && value !== null) {
			const existing = proxyToNode.get(value as object);
			if (existing !== undefined) {
				return existing.raw;
			}
		}
		return value;
	}

	private markVersionChanged(): void {
		this.shallowVersionSignal.set(this.shallowVersionSignal.peek() + 1);
		this.propagateVersionChange(new Set());
	}

	private propagateVersionChange(seen: Set<DeepSignalNode<any>>): void {
		if (seen.has(this)) {
			return;
		}
		seen.add(this);
		this.versionSignal.set(this.versionSignal.peek() + 1);
		for (const parent of this.parents.keys()) {
			parent.propagateVersionChange(seen);
		}
	}

	private updateLengthSignal(length: number): void {
		let lengthSignal = this.propertySignals.get("length");
		if (lengthSignal === undefined) {
			lengthSignal = new SignalNode(length);
			this.propertySignals.set("length", lengthSignal);
			return;
		}
		lengthSignal.set(length);
	}
}

function getOrCreateNode<T extends object>(raw: T): DeepSignalNode<T> {
	let node = rawToNode.get(raw) as DeepSignalNode<T> | undefined;
	if (node === undefined) {
		node = new DeepSignalNode(raw);
	}
	return node;
}

export const isDeepSignal = (source: unknown): source is DeepSignal<object> =>
	isObject(source) && proxyToNode.has(source as object);

export function deepSignal<T extends object>(source: T): DeepSignal<T> {
	if (isDeepSignal(source)) {
		return source as DeepSignal<T>;
	}
	if (!isObservable(source)) {
		throw new Error("This object can't be observed.");
	}
	return getOrCreateNode(source).proxy;
}

export const peek = <T extends DeepSignal<object>, K extends keyof T>(
	source: T,
	key: K,
): T[K] => untracked(() => source[key]);

export const trackDeepSignalVersion = (
	source: DeepSignal<object>,
): number => {
	const node = proxyToNode.get(source as object);
	if (node === undefined) {
		throw new Error("trackDeepSignalVersion received a non-deep signal");
	}
	return node.getVersion().get();
};

export const peekDeepSignalVersion = (
	source: DeepSignal<object>,
): number => {
	const node = proxyToNode.get(source as object);
	if (node === undefined) {
		throw new Error("peekDeepSignalVersion received a non-deep signal");
	}
	return node.getVersion().peek();
};

export const trackDeepSignalShallowVersion = (
	source: DeepSignal<object>,
): number => {
	const node = proxyToNode.get(source as object);
	if (node === undefined) {
		throw new Error("trackDeepSignalShallowVersion received a non-deep signal");
	}
	return node.getShallowVersion().get();
};

export const peekDeepSignalShallowVersion = (
	source: DeepSignal<object>,
): number => {
	const node = proxyToNode.get(source as object);
	if (node === undefined) {
		throw new Error("peekDeepSignalShallowVersion received a non-deep signal");
	}
	return node.getShallowVersion().peek();
};

type DeepSignalObject<T extends object> = {
	[K in keyof T]: DeepSignal<T[K]>;
};

export type DeepSignal<T> = T extends (...args: any[]) => any
	? T
	: T extends readonly any[]
		? DeepSignalObject<T>
		: T extends object
			? DeepSignalObject<T>
			: T;
