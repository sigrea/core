import {
	type DeepSignal,
	deepSignal as createDeepSignal,
} from "alien-deepsignals";

export type { DeepSignal };

export function deepSignal<T extends object>(value: T): DeepSignal<T> {
	return createDeepSignal(value);
}
