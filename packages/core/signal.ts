import { type Signal as _Signal, signal as _signal } from "alien-deepsignals";

export type Signal<T> = Pick<_Signal<T>, "value" | "peek">;

export function signal<T>(...args: []): Signal<T | undefined>;
export function signal<T>(...args: [T]): Signal<T>;
export function signal<T>(...args: [T?]) {
	return args.length === 0
		? (_signal<T | undefined>() as Signal<T | undefined>)
		: (_signal(args[0] as T) as Signal<T>);
}
