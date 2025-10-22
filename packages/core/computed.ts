import {
	type Computed as _Computed,
	computed as _computed,
} from "alien-deepsignals";

export type Computed<T> = Pick<_Computed<T>, "value" | "peek">;

export function computed<T>(getter: () => T): Computed<T> {
	return _computed(getter) as Computed<T>;
}
