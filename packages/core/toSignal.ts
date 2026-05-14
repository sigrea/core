import { computed } from "./computed";
import type { ReadonlySignal } from "./readonly";

export function toSignal<TSource extends object, TKey extends keyof TSource>(
	source: TSource,
	key: TKey,
): ReadonlySignal<TSource[TKey]> {
	return computed(() => source[key]);
}
