import {
	ITERATE_KEY,
	MAP_KEY_ITERATE_KEY,
	TrackOpType,
	TriggerOpType,
	hasChanged,
	isMap,
	isSet,
	isSignal,
	track,
	trigger,
} from "../../reactivity";

import { warnReadonlyOperation } from "./base";
import type { HandlerHooks } from "./types";

type MapTypes = Map<unknown, unknown> | WeakMap<object, unknown>;
type SetTypes = Set<unknown> | WeakSet<object>;
type IterableCollections = Map<unknown, unknown> | Set<unknown>;
type CollectionTypes = MapTypes | SetTypes;

type Instrumentations = Record<PropertyKey, unknown>;

interface IteratorResultLike<T> {
	next(): IteratorResult<T>;
	[Symbol.iterator](): Iterator<T>;
}

export function createCollectionHandlers(
	hooks: HandlerHooks,
): ProxyHandler<object> {
	const instrumentations = createInstrumentations(hooks);
	const hasInstrumentation = (key: PropertyKey): boolean =>
		Object.prototype.hasOwnProperty.call(instrumentations, key);

	return {
		get(target, key, receiver) {
			if (key === hooks.rawSymbol) {
				return target;
			}
			const useInstrumentation =
				hasInstrumentation(key as PropertyKey) && key in target;
			if (useInstrumentation) {
				return Reflect.get(instrumentations, key, receiver);
			}
			return Reflect.get(target, key, receiver);
		},

		set(target, key, value, receiver) {
			if (hooks.isReadonly) {
				warnReadonlyOperation(key as PropertyKey);
				return true;
			}
			return Reflect.set(target, key, value, receiver);
		},

		deleteProperty(target, key) {
			if (hooks.isReadonly) {
				warnReadonlyOperation(key as PropertyKey);
				return true;
			}
			return Reflect.deleteProperty(target, key);
		},
	};
}

function createInstrumentations(hooks: HandlerHooks): Instrumentations {
	const {
		wrap,
		unwrap,
		markVersionChanged,
		rawSymbol,
		registerParent,
		unregisterParent,
	} = hooks;
	const readonly = hooks.isReadonly === true;

	const instrumentations: Instrumentations = {
		get(this: MapTypes, key: unknown) {
			const target = getRawTarget<MapTypes>(this, rawSymbol);
			const rawKey = unwrap(key);
			if (!Object.is(key, rawKey)) {
				track(target, TrackOpType.GET, key);
			}
			track(target, TrackOpType.GET, rawKey);
			const resolvedKey = resolveTargetKey(target, key, rawKey);
			return wrap(target.get(resolvedKey as never));
		},

		has(this: CollectionTypes, key: unknown): boolean {
			const target = getRawTarget<CollectionTypes>(this, rawSymbol);
			const rawKey = unwrap(key);
			if (!Object.is(key, rawKey)) {
				track(target, TrackOpType.HAS, key);
			}
			track(target, TrackOpType.HAS, rawKey);
			return target.has(key as never) || target.has(rawKey as never);
		},

		add(this: SetTypes, value: unknown) {
			if (readonly) {
				warnReadonlyOperation("add");
				return this;
			}
			const target = getRawTarget<SetTypes>(this, rawSymbol);
			const rawValue = unwrap(value);
			let resolvedValue = value;
			let hadKey = target.has(resolvedValue as never);
			if (!hadKey) {
				resolvedValue = rawValue;
				hadKey = target.has(resolvedValue as never);
			}
			if (!hadKey) {
				target.add(resolvedValue as never);
				registerParent(target, resolvedValue);
				trigger(target, TriggerOpType.ADD, resolvedValue, resolvedValue);
				markVersionChanged(target);
			}
			return this;
		},

		set(this: MapTypes, key: unknown, value: unknown) {
			if (readonly) {
				warnReadonlyOperation("set");
				return this;
			}
			const target = getRawTarget<MapTypes>(this, rawSymbol);
			const rawKey = unwrap(key);
			const rawValue = unwrap(value);
			let resolvedKey = key;
			let hadKey = target.has(resolvedKey as never);
			if (!hadKey) {
				resolvedKey = rawKey;
				hadKey = target.has(resolvedKey as never);
			}
			const oldValue = hadKey ? target.get(resolvedKey as never) : undefined;
			if (hadKey && isSignal(oldValue) && !isSignal(rawValue)) {
				(oldValue as { value: unknown }).value = rawValue;
				return this;
			}
			target.set(resolvedKey as never, rawValue);
			if (!hadKey) {
				registerParent(target, resolvedKey);
				registerParent(target, rawValue);
				trigger(target, TriggerOpType.ADD, resolvedKey, rawValue);
				markVersionChanged(target);
			} else if (hasChanged(rawValue, oldValue)) {
				unregisterParent(target, oldValue);
				registerParent(target, rawValue);
				trigger(target, TriggerOpType.SET, resolvedKey, rawValue);
				markVersionChanged(target);
			}
			return this;
		},

		delete(this: CollectionTypes, key: unknown) {
			if (readonly) {
				warnReadonlyOperation("delete");
				return false;
			}
			const target = getRawTarget<CollectionTypes>(this, rawSymbol);
			const rawKey = unwrap(key);
			let resolvedKey = key;
			let hadKey = target.has(resolvedKey as never);
			if (!hadKey) {
				resolvedKey = rawKey;
				hadKey = target.has(resolvedKey as never);
			}
			const isMapTarget = isMap(target);
			const oldValue =
				hadKey && isMapTarget
					? (target as Map<unknown, unknown>).get(resolvedKey as never)
					: undefined;
			const result = target.delete(resolvedKey as never);
			if (hadKey && result) {
				unregisterParent(target, resolvedKey);
				if (isMapTarget) {
					unregisterParent(target, oldValue);
				}
				trigger(target, TriggerOpType.DELETE, resolvedKey);
				markVersionChanged(target);
			}
			return result;
		},

		clear(this: IterableCollections) {
			if (readonly) {
				warnReadonlyOperation("clear");
				return undefined;
			}
			const target = getRawTarget<IterableCollections>(this, rawSymbol);
			const hadItems = target.size !== 0;
			if (hadItems) {
				if (isMap(target)) {
					for (const [key, value] of target.entries()) {
						unregisterParent(target, key);
						unregisterParent(target, value);
					}
				} else {
					for (const value of target.values()) {
						unregisterParent(target, value);
					}
				}
			}
			const result = target.clear();
			if (hadItems) {
				trigger(target, TriggerOpType.CLEAR);
				markVersionChanged(target);
			}
			return result;
		},

		forEach(
			this: IterableCollections,
			callback: (
				value: unknown,
				key: unknown,
				collection: IterableCollections,
			) => void,
			thisArg?: unknown,
		) {
			const target = getRawTarget<IterableCollections>(this, rawSymbol);
			if (typeof target.forEach !== "function") {
				return undefined;
			}
			track(target, TrackOpType.ITERATE, ITERATE_KEY);
			return target.forEach((value: unknown, key: unknown) => {
				callback.call(thisArg, wrap(value), wrap(key), this);
			});
		},
	};

	Object.defineProperty(instrumentations, "size", {
		get(this: IterableCollections) {
			const target = getRawTarget<IterableCollections>(this, rawSymbol);
			if (isMap(target) || isSet(target)) {
				track(target, TrackOpType.ITERATE, ITERATE_KEY);
			}
			return Reflect.get(target, "size", target);
		},
	});

	const iteratorMethods: Array<
		"keys" | "values" | "entries" | typeof Symbol.iterator
	> = ["keys", "values", "entries", Symbol.iterator];

	for (const method of iteratorMethods) {
		instrumentations[method] = createIterableMethod(method, hooks);
	}

	return instrumentations;
}

function createIterableMethod(
	method: "keys" | "values" | "entries" | typeof Symbol.iterator,
	hooks: HandlerHooks,
): (...args: unknown[]) => IteratorResultLike<unknown> | undefined {
	const { wrap, rawSymbol } = hooks;

	return function (this: IterableCollections, ...args: unknown[]) {
		const target = getRawTarget<IterableCollections>(this, rawSymbol);
		const targetMethod = Reflect.get(target as object, method, target) as
			| ((...methodArgs: unknown[]) => Iterator<unknown>)
			| undefined;
		if (typeof targetMethod !== "function") {
			return undefined;
		}
		const isMapTarget = isMap(target);
		const innerIterator = targetMethod.apply(target, args);
		const isPair =
			method === "entries" || (method === Symbol.iterator && isMapTarget);
		const isKeyOnly = method === "keys" && isMapTarget;
		track(
			target,
			TrackOpType.ITERATE,
			isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY,
		);
		return createWrappingIterator(innerIterator, wrap, isPair);
	};
}

function createWrappingIterator(
	inner: Iterator<unknown>,
	wrap: (value: unknown) => unknown,
	isPair: boolean,
): IteratorResultLike<unknown> {
	return {
		next() {
			const { value, done } = inner.next();
			if (done) {
				return { value, done };
			}
			if (isPair && Array.isArray(value)) {
				return {
					value: [wrap(value[0]), wrap(value[1])],
					done,
				};
			}
			return { value: wrap(value), done };
		},
		[Symbol.iterator]() {
			return this;
		},
	};
}

function resolveTargetKey(
	target: MapTypes,
	key: unknown,
	rawKey: unknown,
): unknown {
	return target.has(key as never) ? key : rawKey;
}

function getRawTarget<T extends CollectionTypes>(
	proxy: CollectionTypes,
	rawSymbol: symbol,
): T {
	return Reflect.get(proxy, rawSymbol) as T;
}
