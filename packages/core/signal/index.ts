import {
	type Signal as AlienSignal,
	signal as createSignal,
} from "alien-deepsignals";

type SignalImpl<T> = AlienSignal<T>;

export type Signal<T> = Pick<SignalImpl<T>, "value" | "peek">;

export function signal<T>(...args: []): Signal<T | undefined>;
export function signal<T>(...args: [T]): Signal<T>;
export function signal<T>(...args: [T?]) {
	if (args.length === 0) {
		return createSignal<T | undefined>() as Signal<T | undefined>;
	}

	return createSignal(args[0] as T) as Signal<T>;
}
