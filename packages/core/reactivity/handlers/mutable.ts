import { createBaseHandlers } from "./base";
import type { HandlerHooks } from "./types";

export function createMutableHandlers(
	hooks: HandlerHooks,
): ProxyHandler<object> {
	return createBaseHandlers(hooks);
}
