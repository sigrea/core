import {
	type Computed as AlienComputed,
	computed as createComputed,
} from "alien-deepsignals";

type ComputedImpl<T> = AlienComputed<T>;

export type Computed<T> = Pick<ComputedImpl<T>, "value" | "peek">;

export function computed<T>(getter: () => T): Computed<T> {
	return createComputed(getter) as Computed<T>;
}
