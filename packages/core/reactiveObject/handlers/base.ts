import { __DEV__ } from "../../../constants";
import {
	TrackOpType,
	TriggerOpType,
	isSignal,
	pauseTracking,
	resumeTracking,
	track,
	trigger,
} from "../../reactivity";

import type { HandlerHooks } from "./types";

const wellKnownSymbols = new Set(
	Object.getOwnPropertyNames(Symbol)
		.map((key) => Symbol[key as keyof typeof Symbol])
		.filter((value): value is symbol => typeof value === "symbol"),
);

function hasOwn(target: object, key: PropertyKey): boolean {
	return Object.prototype.hasOwnProperty.call(target, key);
}

export function warnReadonlyOperation(key: PropertyKey): void {
	if (__DEV__) {
		// eslint-disable-next-line no-console
		console.warn(
			`Set operation on key "${String(key)}" failed: target is readonly.`,
		);
	}
}

export function createBaseHandlers(hooks: HandlerHooks): ProxyHandler<object> {
	return {
		get(target, key, receiver) {
			if (key === hooks.rawSymbol) {
				return target;
			}
			if (typeof key === "symbol" && wellKnownSymbols.has(key)) {
				if (key === Symbol.iterator) {
					track(target, TrackOpType.ITERATE);
				}
				return Reflect.get(target, key, receiver);
			}

			track(target, TrackOpType.GET, key);
			const value = Reflect.get(target, key, receiver);
			hooks.registerParent(target, value);
			return hooks.wrap(value, key);
		},

		set(target, key, value, receiver) {
			if (hooks.isReadonly) {
				warnReadonlyOperation(key);
				return true;
			}

			const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
			if (descriptor !== undefined && descriptor.set !== undefined) {
				const setter = descriptor.set;
				const getter = descriptor.get as
					| ((this: unknown) => unknown)
					| undefined;
				const readGetter = (): unknown =>
					getter !== undefined
						? getter.call(receiver)
						: (target as Record<PropertyKey, unknown>)[key];
				const readWithPausedTracking = (fn: () => unknown): unknown => {
					pauseTracking();
					try {
						return fn();
					} finally {
						resumeTracking();
					}
				};

				const previousValue = readWithPausedTracking(readGetter);

				const rawValue = hooks.unwrap(value);
				setter.call(receiver, rawValue);

				const nextValue = readWithPausedTracking(readGetter);
				hooks.unregisterParent(target, previousValue);
				hooks.registerParent(target, nextValue);
				const shouldNotify =
					getter === undefined || !Object.is(previousValue, nextValue);
				if (shouldNotify) {
					trigger(target, TriggerOpType.SET, key, nextValue);
					hooks.markVersionChanged(target);
				}
				return true;
			}

			const rawValue = hooks.unwrap(value);
			const hadKey = hasOwn(target, key);
			const currentValue = hadKey
				? (target as Record<PropertyKey, unknown>)[key]
				: undefined;
			if (hadKey) {
				hooks.unregisterParent(target, currentValue);
			}
			if (hadKey && isSignal(currentValue) && !isSignal(rawValue)) {
				(currentValue as { value: unknown }).value = rawValue;
				return true;
			}
			const result = Reflect.set(target, key, rawValue);
			if (!result) {
				return false;
			}
			hooks.registerParent(target, rawValue);

			const shouldNotify = !hadKey || !Object.is(currentValue, rawValue);
			if (!hadKey) {
				trigger(target, TriggerOpType.ADD, key, rawValue);
			} else if (shouldNotify) {
				trigger(target, TriggerOpType.SET, key, rawValue);
			}

			if (shouldNotify) {
				hooks.markVersionChanged(target);
			}

			return true;
		},

		deleteProperty(target, key) {
			if (hooks.isReadonly) {
				warnReadonlyOperation(key);
				return true;
			}

			const hadKey = hasOwn(target, key);
			const currentValue = hadKey
				? (target as Record<PropertyKey, unknown>)[key]
				: undefined;
			const result = Reflect.deleteProperty(target, key);
			if (!result) {
				return false;
			}
			if (hadKey) {
				hooks.unregisterParent(target, currentValue);
				trigger(target, TriggerOpType.DELETE, key);
				hooks.markVersionChanged(target);
			}
			return true;
		},

		has(target, key) {
			track(target, TrackOpType.HAS, key);
			return key in target;
		},

		ownKeys(target) {
			track(target, TrackOpType.ITERATE);
			const keys = Reflect.ownKeys(target);
			return keys.map((key) =>
				typeof key === "number" ? String(key) : (key as string | symbol),
			);
		},

		defineProperty(target, key, descriptor) {
			if (hooks.isReadonly) {
				warnReadonlyOperation(key);
				return true;
			}

			const hadKey = hasOwn(target, key);
			const currentValue = hadKey
				? (target as Record<PropertyKey, unknown>)[key]
				: undefined;
			const nextDescriptor: PropertyDescriptor = { ...descriptor };
			if ("value" in nextDescriptor) {
				nextDescriptor.value = hooks.unwrap(nextDescriptor.value);
			}
			const result = Reflect.defineProperty(target, key, nextDescriptor);
			if (!result) {
				return false;
			}
			if (hadKey) {
				hooks.unregisterParent(target, currentValue);
			}

			const hasValue = "value" in nextDescriptor;
			const valueChanged =
				hasValue && !Object.is(nextDescriptor.value, currentValue);
			if (!hadKey) {
				trigger(target, TriggerOpType.ADD, key, nextDescriptor.value);
			} else if (valueChanged) {
				trigger(target, TriggerOpType.SET, key, nextDescriptor.value);
			}

			if (!hadKey || valueChanged) {
				hooks.markVersionChanged(target);
			}
			if (hasValue) {
				hooks.registerParent(target, nextDescriptor.value);
			}

			return true;
		},

		getOwnPropertyDescriptor(target, key) {
			return Reflect.getOwnPropertyDescriptor(target, key);
		},
	};
}
