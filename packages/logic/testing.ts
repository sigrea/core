import { isLogicInstance } from "./instance";
import { disposeLogic } from "./internals";
import type { LogicArgs, LogicFunction, LogicInstance } from "./types";

const tracked = new Set<LogicInstance<object>>();

export function mountLogic<T extends object, P = void>(
	logic: LogicFunction<T, P>,
	...args: LogicArgs<P>
): LogicInstance<T> {
	const instance = logic(...args);
	tracked.add(instance as LogicInstance<object>);
	return instance;
}

export function cleanupLogic<T extends object>(
	instance: LogicInstance<T>,
): void {
	if (!isLogicInstance(instance)) {
		return;
	}
	disposeLogic(instance);
	tracked.delete(instance as LogicInstance<object>);
}

export function cleanupLogics(): void {
	for (const instance of tracked) {
		disposeLogic(instance);
	}
	tracked.clear();
}
