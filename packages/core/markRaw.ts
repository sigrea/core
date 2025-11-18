import { SignalFlags, isObject } from "./reactivity";

function defineSkipFlag(target: object): void {
	Object.defineProperty(target, SignalFlags.SKIP, {
		value: true,
		enumerable: false,
		configurable: true,
		writable: true,
	});
}

export function markRaw<T>(value: T): T {
	if (isObject(value)) {
		defineSkipFlag(value as object);
	}
	return value;
}

export function isRaw(value: unknown): value is object {
	return (
		isObject(value) &&
		Boolean((value as Record<PropertyKey, unknown>)[SignalFlags.SKIP])
	);
}
