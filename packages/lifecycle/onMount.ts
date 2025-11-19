import { isPromiseLike, logUnhandledAsyncError } from "../core/internal/async";
import type { Cleanup, Scope } from "../core/scope";
import {
	createScope,
	getCurrentScope,
	registerScopeCleanup,
	runWithScope,
} from "../core/scope";

export interface MountOptions {
	parent?: Scope;
}

export type { Cleanup, Scope };

type MountCallbackResult = void | Cleanup | Promise<void | Cleanup>;

function registerMountResult(result: MountCallbackResult, scope: Scope): void {
	if (typeof result === "function") {
		registerScopeCleanup(result, scope);
		return;
	}

	if (isPromiseLike(result)) {
		Promise.resolve(result)
			.then((cleanup) => {
				if (typeof cleanup === "function") {
					registerScopeCleanup(cleanup, scope);
				}
			})
			.catch((error) => {
				logUnhandledAsyncError("onMount callback", error);
			});
	}
}

export function onMount(
	callback: () => MountCallbackResult,
	options?: MountOptions,
): Scope {
	const parent = options?.parent ?? getCurrentScope();
	const scope = createScope(parent);

	runWithScope(scope, () => {
		const result = callback();
		registerMountResult(result, scope);
	});

	return scope;
}
