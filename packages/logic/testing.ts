import { isLogicInstance } from "./instance";
import { disposeLogic } from "./internals";
import type { LogicArgs, LogicFunction, LogicInstance } from "./types";

const tracked = new Set<LogicInstance<object>>();

function collectErrors(target: unknown, errors: unknown[]): void {
	if (target instanceof AggregateError) {
		for (const error of target.errors) {
			errors.push(error);
		}
		return;
	}
	errors.push(target);
}

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
	const errors: unknown[] = [];

	for (const instance of tracked) {
		try {
			disposeLogic(instance);
		} catch (error) {
			collectErrors(error, errors);
		}
	}
	tracked.clear();

	if (errors.length > 0) {
		throw new AggregateError(
			errors,
			"Failed to cleanup tracked logic instances.",
		);
	}
}
