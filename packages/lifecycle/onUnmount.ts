import { isPromiseLike, logUnhandledAsyncError } from "../core/internal/async";
import type { Cleanup, Scope } from "../core/scope";
import {
	disposeScope,
	getCurrentScope,
	registerScopeCleanup,
} from "../core/scope";

export function onUnmount(scope: Scope): void;
export function onUnmount(callback: Cleanup): void;
export function onUnmount(target: Scope | Cleanup): void {
	if (typeof target === "function") {
		const scope = getCurrentScope();
		if (scope === undefined) {
			// No active scope: execute immediately to avoid dangling cleanup.
			const result = target();
			if (isPromiseLike(result)) {
				Promise.resolve(result).catch((error) => {
					logUnhandledAsyncError("onUnmount cleanup", error);
				});
			}
			return;
		}

		registerScopeCleanup(target, scope);
		return;
	}

	disposeScope(target);
}
