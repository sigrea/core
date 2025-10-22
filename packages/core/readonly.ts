import type { Computed } from "./computed";
import type { Signal } from "./signal";

export interface ReadonlySignal<T> {
	readonly value: T;
	peek(): T;
}

type Source<T> = Signal<T> | Computed<T>;

export function readonly<T>(source: Source<T>): ReadonlySignal<T> {
	return {
		get value() {
			return source.value;
		},
		peek() {
			return source.peek();
		},
	};
}
