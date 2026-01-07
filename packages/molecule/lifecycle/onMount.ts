import {
	isPromiseLike,
	logUnhandledAsyncError,
} from "../../core/internal/async";
import { getActiveMountJobRegistry } from "../../core/internal/mountRegistry";
import type { Cleanup, Scope } from "../../core/scope";
import { getCurrentScope, onDispose } from "../../core/scope";

type MountCallbackResult = void | Cleanup | Promise<void | Cleanup>;

const ON_MOUNT_OUTSIDE_SETUP_MESSAGE =
	"onMount(...) can only be called synchronously during molecule setup.";
const ON_MOUNT_MISSING_SCOPE_MESSAGE =
	"onMount(...) was executed with no active scope. Ensure mountMolecule() runs mount jobs with a scope.";

function registerMountResult(result: MountCallbackResult, scope: Scope): void {
	if (typeof result === "function") {
		onDispose(result, scope);
		return;
	}

	if (isPromiseLike(result)) {
		Promise.resolve(result)
			.then((cleanup) => {
				if (typeof cleanup === "function") {
					onDispose(cleanup, scope);
				}
			})
			.catch((error) => {
				logUnhandledAsyncError("onMount callback", error);
			});
	}
}

export function onMount(callback: () => MountCallbackResult): void {
	const registry = getActiveMountJobRegistry();
	if (registry === undefined) {
		throw new Error(ON_MOUNT_OUTSIDE_SETUP_MESSAGE);
	}

	registry.register(() => {
		const scope = getCurrentScope();
		if (scope === undefined) {
			throw new Error(ON_MOUNT_MISSING_SCOPE_MESSAGE);
		}

		const result = callback();
		registerMountResult(result, scope);
	});
}
