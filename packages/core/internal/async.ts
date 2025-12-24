// import { __DEV__ } from "../../constants";

export function isPromiseLike<T = unknown>(
	value: unknown,
): value is PromiseLike<T> {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		typeof (value as PromiseLike<T>).then === "function"
	);
}

export function logUnhandledAsyncError(source: string, error: unknown): void {
	// if (__DEV__) {
	// 	console.error(`${source} rejected.`, error);
	// }
}
