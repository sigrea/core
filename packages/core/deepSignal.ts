import type { Computed } from "./computed";
import {
	SignalFlags,
	type TypedArray,
	isArray,
	isDate,
	isMap,
	isObject,
	isRegExp,
	isSet,
	isSignal,
	isTypedArray,
	isWeakMap,
	isWeakSet,
} from "./reactivity";
import { createReactiveObject } from "./reactivity/createReactiveObject";
import { createArrayHandlers } from "./reactivity/handlers/array";
import { createCollectionHandlers } from "./reactivity/handlers/collection";
import { createMutableHandlers } from "./reactivity/handlers/mutable";
import { createReadonlyHandlers } from "./reactivity/handlers/readonly";
import type { HandlerHooks } from "./reactivity/handlers/types";
import type { ReadonlySignal } from "./readonly";
import type { Signal } from "./signal";
import { SignalNode } from "./signal";

const RAW_SYMBOL = Symbol("sigrea.raw");

const reactiveMap = new WeakMap<object, DeepSignal<object>>();
const shallowReactiveMap = new WeakMap<object, DeepSignal<object>>();
const proxyToRaw = new WeakMap<object, object>();
const rawToMeta = new WeakMap<object, DeepSignalMeta>();
const readonlyMap = new WeakMap<object, DeepSignal<object>>();
const shallowReadonlyMap = new WeakMap<object, DeepSignal<object>>();
const childParentsMap = new WeakMap<object, Set<object>>();

interface DeepSignalMeta {
	readonly version: SignalNode<number>;
	readonly shallowVersion: SignalNode<number>;
}

function hasSkipFlag(value: unknown): value is object {
	return (
		isObject(value) &&
		Boolean((value as Record<PropertyKey, unknown>)[SignalFlags.SKIP])
	);
}

function shouldSkipReactive(value: unknown): value is object {
	return hasSkipFlag(value) || isDate(value) || isRegExp(value);
}

function assertObject(value: unknown): asserts value is object {
	if (!isObject(value)) {
		throw new Error("This object can't be observed.");
	}
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

function unwrapSignalValue(
	value: unknown,
): { matched: true; value: unknown } | undefined {
	if (isSignal(value)) {
		if (hasSkipFlag(value)) {
			return undefined;
		}
		return { matched: true, value: (value as { value: unknown }).value };
	}
	return undefined;
}

interface WrapConfig {
	readonly: boolean;
	deep: boolean;
	unwrapSignals: boolean;
}

function createWrapFunction(options: WrapConfig) {
	return (value: unknown): unknown => {
		if (options.unwrapSignals) {
			const signalValue = unwrapSignalValue(value);
			if (signalValue !== undefined) {
				return signalValue.value;
			}
		}

		const unwrapped = unwrap(value);
		if (isSignal(unwrapped)) {
			return unwrapped;
		}
		if (
			!options.deep ||
			!isObject(unwrapped) ||
			shouldSkipReactive(unwrapped)
		) {
			return unwrapped;
		}

		return options.readonly
			? readonlyDeepSignal(unwrapped as object)
			: deepSignal(unwrapped as object);
	};
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
	markVersionChangedInternal(target, false, new Set());
}

function markVersionChangedInternal(
	target: object,
	propagateOnly: boolean,
	visited: Set<object>,
): void {
	const meta = getDeepSignalMeta(target);
	if (!propagateOnly) {
		meta.shallowVersion.set(meta.shallowVersion.peek() + 1);
	}
	meta.version.set(meta.version.peek() + 1);
	const parents = childParentsMap.get(target);
	if (parents === undefined) {
		return;
	}
	visited.add(target);
	for (const parent of parents) {
		if (visited.has(parent)) {
			continue;
		}
		markVersionChangedInternal(parent, true, visited);
	}
}

function resolveLinkableChild(value: unknown): object | undefined {
	if (!isObject(value) || value === null) {
		return undefined;
	}
	if (isSignal(value)) {
		return undefined;
	}
	const raw = toRawDeepSignal(value as object);
	if (!isObject(raw) || shouldSkipReactive(raw)) {
		return undefined;
	}
	return raw as object;
}

function registerParentChild(parent: object, value: unknown): void {
	const child = resolveLinkableChild(value);
	if (child === undefined || child === parent) {
		return;
	}
	let parents = childParentsMap.get(child);
	if (parents === undefined) {
		parents = new Set();
		childParentsMap.set(child, parents);
	}
	parents.add(parent);
}

function unregisterParentChild(parent: object, value: unknown): void {
	const child = resolveLinkableChild(value);
	if (child === undefined) {
		return;
	}
	const parents = childParentsMap.get(child);
	if (parents === undefined) {
		return;
	}
	parents.delete(parent);
	if (parents.size === 0) {
		childParentsMap.delete(child);
	}
}

export function trackDeepSignalVersion(
	source: DeepSignal<object> | ReadonlyDeepSignal<object>,
	shallowOnly: boolean,
): number {
	const target = toRawDeepSignal(source as object);
	if (!isObject(target)) {
		return 0;
	}
	const meta = getDeepSignalMeta(target as object);
	if (shallowOnly) {
		meta.shallowVersion.value;
		return meta.shallowVersion.peek();
	}
	meta.version.value;
	return meta.version.peek();
}

export function peekDeepSignalVersion(
	source: DeepSignal<object> | ReadonlyDeepSignal<object>,
	shallowOnly: boolean,
): number {
	const target = toRawDeepSignal(source as object);
	if (!isObject(target)) {
		return 0;
	}
	const meta = getDeepSignalMeta(target as object);
	return shallowOnly ? meta.shallowVersion.peek() : meta.version.peek();
}

function createHooks(options: WrapConfig): HandlerHooks {
	return {
		wrap: createWrapFunction(options),
		unwrap,
		markVersionChanged,
		rawSymbol: RAW_SYMBOL,
		isReadonly: options.readonly ? true : undefined,
		registerParent: registerParentChild,
		unregisterParent: unregisterParentChild,
	};
}

const mutableObjectHooks = createHooks({
	readonly: false,
	deep: true,
	unwrapSignals: true,
});
// Arrays unwrap nested signals so reading list[index] mirrors Vue's ref behavior.
const mutableArrayHooks = createHooks({
	readonly: false,
	deep: true,
	unwrapSignals: true,
});
const mutableCollectionHooks = createHooks({
	readonly: false,
	deep: true,
	unwrapSignals: true,
});

const shallowObjectHooks = createHooks({
	readonly: false,
	deep: false,
	unwrapSignals: false,
});
const shallowArrayHooks = createHooks({
	readonly: false,
	deep: false,
	unwrapSignals: false,
});
const shallowCollectionHooks = createHooks({
	readonly: false,
	deep: false,
	unwrapSignals: false,
});

const readonlyObjectHooks = createHooks({
	readonly: true,
	deep: true,
	unwrapSignals: true,
});
const readonlyArrayHooks = createHooks({
	readonly: true,
	deep: true,
	unwrapSignals: true,
});
const readonlyCollectionHooks = createHooks({
	readonly: true,
	deep: true,
	unwrapSignals: true,
});

const shallowReadonlyObjectHooks = createHooks({
	readonly: true,
	deep: false,
	unwrapSignals: false,
});
const shallowReadonlyArrayHooks = createHooks({
	readonly: true,
	deep: false,
	unwrapSignals: true,
});
const shallowReadonlyCollectionHooks = createHooks({
	readonly: true,
	deep: false,
	unwrapSignals: false,
});

const mutableHandlers = createMutableHandlers(mutableObjectHooks);
const arrayHandlers = createArrayHandlers(mutableArrayHooks);
const collectionHandlers = createCollectionHandlers(mutableCollectionHooks);

const shallowMutableHandlers = createMutableHandlers(shallowObjectHooks);
const shallowArrayHandlers = createArrayHandlers(shallowArrayHooks);
const shallowCollectionHandlers = createCollectionHandlers(
	shallowCollectionHooks,
);

const readonlyMutableHandlers = createReadonlyHandlers(readonlyObjectHooks);
const readonlyArrayHandlers = createArrayHandlers(readonlyArrayHooks);
const readonlyCollectionHandlers = createCollectionHandlers(
	readonlyCollectionHooks,
);

const shallowReadonlyMutableHandlers = createReadonlyHandlers(
	shallowReadonlyObjectHooks,
);
const shallowReadonlyArrayHandlers = createArrayHandlers(
	shallowReadonlyArrayHooks,
);
const shallowReadonlyCollectionHandlers = createCollectionHandlers(
	shallowReadonlyCollectionHooks,
);

interface HandlerSelectionOptions {
	readonly?: boolean;
	shallow?: boolean;
}

function selectHandlers(
	target: object,
	options: HandlerSelectionOptions = {},
): ProxyHandler<object> {
	const readonly = options.readonly === true;
	const shallow = options.shallow === true;
	const handlersByKind = readonly
		? shallow
			? {
					array: shallowReadonlyArrayHandlers,
					collection: shallowReadonlyCollectionHandlers,
					object: shallowReadonlyMutableHandlers,
				}
			: {
					array: readonlyArrayHandlers,
					collection: readonlyCollectionHandlers,
					object: readonlyMutableHandlers,
				}
		: shallow
			? {
					array: shallowArrayHandlers,
					collection: shallowCollectionHandlers,
					object: shallowMutableHandlers,
				}
			: {
					array: arrayHandlers,
					collection: collectionHandlers,
					object: mutableHandlers,
				};
	if (isArray(target) || isTypedArray(target)) {
		return handlersByKind.array;
	}
	if (
		isMap(target) ||
		isSet(target) ||
		isWeakMap(target) ||
		isWeakSet(target)
	) {
		return handlersByKind.collection;
	}
	return handlersByKind.object;
}

export function isDeepSignal(source: unknown): source is DeepSignal<object> {
	return isObject(source) && proxyToRaw.has(source as object);
}

export function deepSignal<T extends object>(source: T): DeepSignal<T> {
	if (isDeepSignal(source)) {
		return source as DeepSignal<T>;
	}
	assertObject(source);
	if (shouldSkipReactive(source)) {
		return source as DeepSignal<T>;
	}
	const target = source as object;
	const handlers = selectHandlers(target);
	const proxy = createReactiveObject(target, reactiveMap, handlers);
	proxyToRaw.set(proxy as object, target);
	return proxy as DeepSignal<T>;
}

export function shallowDeepSignal<T extends object>(
	source: T,
): ShallowDeepSignal<T> {
	if (isDeepSignal(source)) {
		return source as ShallowDeepSignal<T>;
	}
	assertObject(source);
	if (shouldSkipReactive(source)) {
		return source as ShallowDeepSignal<T>;
	}
	const target = source as object;
	const handlers = selectHandlers(target, { shallow: true });
	const proxy = createReactiveObject(target, shallowReactiveMap, handlers);
	proxyToRaw.set(proxy as object, target);
	return proxy as ShallowDeepSignal<T>;
}

export function readonlyDeepSignal<T extends object>(
	source: T | DeepSignal<T>,
): ReadonlyDeepSignal<T> {
	const target = toRawDeepSignal(source);
	assertObject(target);
	if (shouldSkipReactive(target)) {
		return target as ReadonlyDeepSignal<T>;
	}
	const handlers = selectHandlers(target, { readonly: true });
	const proxy = createReactiveObject(target, readonlyMap, handlers);
	proxyToRaw.set(proxy as object, target);
	return proxy as ReadonlyDeepSignal<T>;
}

export function readonlyShallowDeepSignal<T extends object>(
	source: T | DeepSignal<T>,
): ReadonlyShallowDeepSignal<T> {
	const target = toRawDeepSignal(source);
	assertObject(target);
	if (shouldSkipReactive(target)) {
		return target as ReadonlyShallowDeepSignal<T>;
	}
	const handlers = selectHandlers(target, { readonly: true, shallow: true });
	const proxy = createReactiveObject(target, shallowReadonlyMap, handlers);
	proxyToRaw.set(proxy as object, target);
	return proxy as ReadonlyShallowDeepSignal<T>;
}

export function toRawDeepSignal<T>(source: T): T {
	if (isObject(source) && source !== null) {
		const raw = proxyToRaw.get(source as object);
		if (raw !== undefined) {
			return raw as T;
		}
	}
	return source;
}
type DeepSignalObjectValue<T> = T extends Signal<infer U>
	? U
	: T extends ReadonlySignal<infer U>
		? U
		: T extends Computed<infer U>
			? U
			: DeepSignal<T>;

type DeepSignalObject<T extends object> = {
	[K in keyof T]: DeepSignalObjectValue<T[K]>;
};

type DeepSignalArrayMember<T> = DeepSignalObjectValue<T>;

type DeepSignalArray<T> = { [K in keyof T]: DeepSignalArrayMember<T[K]> };

type DeepSignalCollections<T> = T extends Map<infer K, infer V>
	? Map<K, DeepSignalObjectValue<V>>
	: T extends Set<infer V>
		? Set<DeepSignalObjectValue<V>>
		: T extends WeakMap<infer K, infer V>
			? WeakMap<K, DeepSignalObjectValue<V>>
			: T extends WeakSet<infer V>
				? WeakSet<V>
				: never;

export type DeepSignal<T> = T extends (...args: unknown[]) => unknown
	? T
	: T extends TypedArray
		? T
		: T extends readonly unknown[]
			? DeepSignalArray<T>
			: T extends
						| Map<unknown, unknown>
						| Set<unknown>
						| WeakMap<object, unknown>
						| WeakSet<object>
				? DeepSignalCollections<T>
				: T extends Date
					? Date
					: T extends RegExp
						? RegExp
						: T extends object
							? DeepSignalObject<T>
							: T;

type ReadonlyDeepSignalObjectValue<T> = T extends Signal<infer U>
	? U
	: T extends ReadonlySignal<infer U>
		? U
		: T extends Computed<infer U>
			? U
			: ReadonlyDeepSignal<T>;

type ReadonlyDeepSignalObject<T extends object> = {
	readonly [K in keyof T]: ReadonlyDeepSignalObjectValue<T[K]>;
};

type ReadonlyDeepSignalArrayMember<T> = ReadonlyDeepSignalObjectValue<T>;

type ReadonlyDeepSignalArray<T> = {
	readonly [K in keyof T]: ReadonlyDeepSignalArrayMember<T[K]>;
};

type ShallowDeepSignalValue<T> = T extends Signal<infer U>
	? Signal<U>
	: T extends ReadonlySignal<infer U>
		? ReadonlySignal<U>
		: T extends Computed<infer U>
			? Computed<U>
			: T;

type ShallowDeepSignalObject<T extends object> = {
	[K in keyof T]: ShallowDeepSignalValue<T[K]>;
};

type ShallowDeepSignalArray<T> = {
	[K in keyof T]: ShallowDeepSignalValue<T[K]>;
};

type ShallowDeepSignalCollections<T> = T;

export type ShallowDeepSignal<T> = T extends (...args: unknown[]) => unknown
	? T
	: T extends TypedArray
		? T
		: T extends readonly unknown[]
			? ShallowDeepSignalArray<T>
			: T extends
						| Map<unknown, unknown>
						| Set<unknown>
						| WeakMap<object, unknown>
						| WeakSet<object>
				? ShallowDeepSignalCollections<T>
				: T extends object
					? ShallowDeepSignalObject<T>
					: T;

type ReadonlyShallowDeepSignalValue<T> = T extends Signal<infer U>
	? Signal<U>
	: T extends ReadonlySignal<infer U>
		? ReadonlySignal<U>
		: T extends Computed<infer U>
			? Computed<U>
			: T;

type ReadonlyShallowDeepSignalObject<T extends object> = {
	readonly [K in keyof T]: ReadonlyShallowDeepSignalValue<T[K]>;
};

type ReadonlyShallowDeepSignalArray<T> = {
	readonly [K in keyof T]: ReadonlyShallowDeepSignalValue<T[K]>;
};

type ReadonlyShallowDeepSignalCollections<T> = T;

export type ReadonlyShallowDeepSignal<T> = T extends (
	...args: unknown[]
) => unknown
	? T
	: T extends TypedArray
		? T
		: T extends readonly unknown[]
			? ReadonlyShallowDeepSignalArray<T>
			: T extends
						| Map<unknown, unknown>
						| Set<unknown>
						| WeakMap<object, unknown>
						| WeakSet<object>
				? ReadonlyShallowDeepSignalCollections<T>
				: T extends object
					? ReadonlyShallowDeepSignalObject<T>
					: T;

type ReadonlyDeepSignalCollections<T> = T extends Map<infer K, infer V>
	? ReadonlyMap<K, ReadonlyDeepSignalObjectValue<V>>
	: T extends Set<infer V>
		? ReadonlySet<ReadonlyDeepSignalObjectValue<V>>
		: T extends WeakMap<infer K, infer V>
			? WeakMap<K, ReadonlyDeepSignalObjectValue<V>>
			: T extends WeakSet<infer V>
				? WeakSet<V>
				: never;

export type ReadonlyDeepSignal<T> = T extends (...args: unknown[]) => unknown
	? T
	: T extends TypedArray
		? T
		: T extends readonly unknown[]
			? ReadonlyDeepSignalArray<T>
			: T extends
						| Map<unknown, unknown>
						| Set<unknown>
						| WeakMap<object, unknown>
						| WeakSet<object>
				? ReadonlyDeepSignalCollections<T>
				: T extends object
					? ReadonlyDeepSignalObject<T>
					: T;
