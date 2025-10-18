import type { MountCallback, UnmountCallback } from "../lifecycle/types";
import { Signal, isSignal } from "../signal";

class ReadonlySignalImpl<T> extends Signal<T> {
	constructor(private readonly source: Signal<T>) {
		// Avoid reading source during construction so no subscribers are linked prematurely.
		super(undefined as T);
	}

	override get value(): T {
		return this.source.value as T;
	}

	// eslint-disable-next-line accessor-pairs -- readonly wrapper forbids setters
	override set value(_: T) {
		throw new TypeError("Cannot set value on a readonly Signal");
	}

	override onMount(callback: MountCallback): () => void {
		return this.source.onMount(callback);
	}

	override onUnmount(callback: UnmountCallback): () => void {
		return this.source.onUnmount(callback);
	}

	override get _listenerCount(): number {
		return this.source._listenerCount;
	}

	override get _isMounted(): boolean {
		return this.source._isMounted;
	}
}

export type ReadonlySignal<T> = Omit<Signal<T>, "value"> & {
	readonly value: T;
};

export function readonly<T>(store: Signal<T>): ReadonlySignal<T> {
	if (!isSignal(store)) {
		throw new TypeError("readonly can only be applied to a Signal");
	}

	return new ReadonlySignalImpl(store) as unknown as ReadonlySignal<T>;
}

export function isReadonly<T = unknown>(
	value: unknown,
): value is ReadonlySignal<T> {
	return value instanceof ReadonlySignalImpl;
}
