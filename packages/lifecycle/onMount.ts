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

export function onMount(
	callback: () => void | Cleanup,
	options?: MountOptions,
): Scope {
	const parent = options?.parent ?? getCurrentScope();
	const scope = createScope(parent);

	runWithScope(scope, () => {
		const cleanup = callback();
		if (typeof cleanup === "function") {
			registerScopeCleanup(cleanup, scope);
		}
	});

	return scope;
}
