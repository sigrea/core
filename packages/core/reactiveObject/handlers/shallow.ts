import { createBaseHandlers } from "./base";
import type { HandlerHooks } from "./types";

export function createShallowHandlers(
	hooks: HandlerHooks,
): ProxyHandler<object> {
	return createBaseHandlers({
		...hooks,
		wrap(value) {
			return value;
		},
	});
}
