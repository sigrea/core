import { createBaseHandlers } from "./base";
import type { HandlerHooks } from "./types";

export function createReadonlyHandlers(
	hooks: HandlerHooks,
): ProxyHandler<object> {
	return createBaseHandlers({ ...hooks, isReadonly: true });
}
