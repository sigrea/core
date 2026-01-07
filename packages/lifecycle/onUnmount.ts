import { getActiveMountJobRegistry } from "../core/internal/mountRegistry";
import type { Cleanup, Scope } from "../core/scope";
import { getCurrentScope, onDispose } from "../core/scope";

const ON_UNMOUNT_OUTSIDE_SCOPE_MESSAGE =
	"onUnmount(...) can only be called during molecule setup or while a molecule is mounted.";
const ON_UNMOUNT_MISSING_SCOPE_MESSAGE =
	"onUnmount(...) was executed with no active scope. Ensure mountMolecule() runs mount jobs with a scope.";

function registerInScope(cleanup: Cleanup, scope: Scope | undefined): void {
	if (scope === undefined) {
		throw new Error(ON_UNMOUNT_MISSING_SCOPE_MESSAGE);
	}
	onDispose(cleanup, scope);
}

export function onUnmount(cleanup: Cleanup): void {
	const registry = getActiveMountJobRegistry();
	if (registry !== undefined) {
		registry.register(() => {
			registerInScope(cleanup, getCurrentScope());
		});
		return;
	}

	const scope = getCurrentScope();
	if (scope === undefined) {
		throw new Error(ON_UNMOUNT_OUTSIDE_SCOPE_MESSAGE);
	}

	registerInScope(cleanup, scope);
}
