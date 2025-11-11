import { createBaseHandlers } from "./base";
import type { HandlerHooks } from "./types";

export function createArrayHandlers(hooks: HandlerHooks): ProxyHandler<object> {
	return createBaseHandlers(hooks);
}
