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
			target();
			return;
		}

		registerScopeCleanup(target, scope);
		return;
	}

	disposeScope(target);
}
