import type { Computed } from "..";
import type { Signal } from "..";

export interface ReadonlySignal<T> {
	readonly value: T;
	peek(): T;
}

type Readable<T> = Signal<T> | Computed<T>;

export function readonly<T>(source: Readable<T>): ReadonlySignal<T> {
	return {
		get value() {
			return source.value;
		},
		peek() {
			return source.peek();
		},
	};
}
