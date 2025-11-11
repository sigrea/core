import {
	isArray,
	isMap,
	isObject,
	isSet,
	isTypedArray,
	isWeakMap,
	isWeakSet,
} from "./reactivity";
import { createReactiveObject } from "./reactivity/createReactiveObject";
import { createArrayHandlers } from "./reactivity/handlers/array";
import { createCollectionHandlers } from "./reactivity/handlers/collection";
import { createMutableHandlers } from "./reactivity/handlers/mutable";
import type { HandlerHooks } from "./reactivity/handlers/types";
import { SignalNode } from "./signal";

const RAW_SYMBOL = Symbol("sigrea.raw");

const reactiveMap = new WeakMap<object, DeepSignal<object>>();
const proxyToRaw = new WeakMap<object, object>();
const rawToMeta = new WeakMap<object, DeepSignalMeta>();

type SupportedConstructor = new (...args: unknown[]) => object;

const supportedConstructors = new Set<SupportedConstructor>([
	Object,
	Array,
	Map,
	Set,
	WeakMap,
	WeakSet,
]);

interface DeepSignalMeta {
	readonly version: SignalNode<number>;
	readonly shallowVersion: SignalNode<number>;
}

function isObservable(value: unknown): value is object {
	if (!isObject(value) || value === null) {
		return false;
	}
	const ctor = (value as { constructor?: unknown }).constructor;
	if (isTypedArray(value)) {
		return true;
	}
	return (
		typeof ctor === "function" &&
		supportedConstructors.has(ctor as SupportedConstructor)
	);
}

function unwrap(value: unknown): unknown {
	if (isObject(value) && value !== null) {
		const raw = proxyToRaw.get(value as object);
		if (raw !== undefined) {
			return raw;
		}
	}
	return value;
}

function wrapValue(value: unknown): unknown {
	const unwrapped = unwrap(value);
	if (!isObject(unwrapped) || unwrapped === null || !isObservable(unwrapped)) {
		return unwrapped;
	}
	return deepSignal(unwrapped as object);
}

function getDeepSignalMeta(target: object): DeepSignalMeta {
	let meta = rawToMeta.get(target);
	if (meta === undefined) {
		meta = {
			version: new SignalNode(0),
			shallowVersion: new SignalNode(0),
		};
		rawToMeta.set(target, meta);
	}
	return meta;
}

function markVersionChanged(target: object): void {
	const meta = getDeepSignalMeta(target);
	meta.shallowVersion.set(meta.shallowVersion.peek() + 1);
	meta.version.set(meta.version.peek() + 1);
}

const sharedHooks: HandlerHooks = {
	wrap: wrapValue,
	unwrap,
	markVersionChanged,
	rawSymbol: RAW_SYMBOL,
};

const mutableHandlers = createMutableHandlers(sharedHooks);
const arrayHandlers = createArrayHandlers(sharedHooks);
const collectionHandlers = createCollectionHandlers(sharedHooks);

function selectHandlers(target: object): ProxyHandler<object> {
	if (isArray(target) || isTypedArray(target)) {
		return arrayHandlers;
	}
	if (
		isMap(target) ||
		isSet(target) ||
		isWeakMap(target) ||
		isWeakSet(target)
	) {
		return collectionHandlers;
	}
	return mutableHandlers;
}

export function isDeepSignal(source: unknown): source is DeepSignal<object> {
	return isObject(source) && proxyToRaw.has(source as object);
}

export function deepSignal<T extends object>(source: T): DeepSignal<T> {
	if (isDeepSignal(source)) {
		return source as DeepSignal<T>;
	}
	if (!isObservable(source)) {
		throw new Error("This object can't be observed.");
	}
	const handlers = selectHandlers(source);
	const proxy = createReactiveObject(source, reactiveMap, handlers);
	proxyToRaw.set(proxy as object, source);
	return proxy as DeepSignal<T>;
}
type DeepSignalObject<T extends object> = {
	[K in keyof T]: DeepSignal<T[K]>;
};

export type DeepSignal<T> = T extends (...args: unknown[]) => unknown
	? T
	: T extends readonly unknown[]
		? DeepSignalObject<T>
		: T extends object
			? DeepSignalObject<T>
			: T;
