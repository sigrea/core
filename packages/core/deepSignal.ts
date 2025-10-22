import { type DeepSignal, deepSignal as _deepSignal } from "alien-deepsignals";

export type { DeepSignal };

export function deepSignal<T extends object>(value: T): DeepSignal<T> {
	return _deepSignal(value);
}
