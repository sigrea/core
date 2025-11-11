const resolvedPromise = Promise.resolve();

export function nextTick<T = void>(
	fn?: () => T,
): Promise<T extends void ? void : T | void>;
export function nextTick<T = void>(fn?: () => T): Promise<T | void> {
	if (fn === undefined) {
		return resolvedPromise.then(() => {});
	}
	return resolvedPromise.then(fn);
}
