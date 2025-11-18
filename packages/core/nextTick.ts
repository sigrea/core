import { awaitSchedulerFlush } from "./scheduler";

export function nextTick<T = void>(
	fn?: () => T,
): Promise<T extends void ? void : T | void>;
export function nextTick<T = void>(fn?: () => T): Promise<T | void> {
	const promise = awaitSchedulerFlush();
	if (fn === undefined) {
		return promise.then(() => {});
	}
	return promise.then(fn);
}
