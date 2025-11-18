import type { Computed } from "./computed";
import type { DeepSignal, ReadonlyDeepSignal } from "./deepSignal";
import { isDeepSignal, readonlyDeepSignal } from "./deepSignal";
import { SignalFlags, isSignal } from "./reactivity";
import type { Signal } from "./signal";

export interface ReadonlySignal<T> {
	readonly value: T;
	peek(): T;
}

type Source<T> = Signal<T> | Computed<T>;

class ReadonlySignalWrapper<T> implements ReadonlySignal<T> {
	readonly [SignalFlags.IS_SIGNAL] = true;

	constructor(private readonly source: Source<T>) {}

	get value(): T {
		return this.source.value;
	}

	peek(): T {
		return this.source.peek();
	}
}

export function readonly<T>(source: Source<T>): ReadonlySignal<T>;
export function readonly<T extends object>(
	source: DeepSignal<T>,
): ReadonlyDeepSignal<T>;
export function readonly<T>(
	source: Source<T> | (T extends object ? DeepSignal<T> : never),
): ReadonlySignal<T> | ReadonlyDeepSignal<T> {
	if (isDeepSignal(source)) {
		return readonlyDeepSignal(
			source as DeepSignal<object>,
		) as ReadonlyDeepSignal<T>;
	}
	if (isSignal(source)) {
		return new ReadonlySignalWrapper(source as Source<T>);
	}
	throw new TypeError("Invalid readonly source.");
}
