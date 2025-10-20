import {
	type Effect as EffectImpl,
	effect as createEffect,
} from "alien-deepsignals";

import { getCurrentScope, registerScopeCleanup } from "../scope";

export type Effect<T = void> = EffectImpl<T>;
export type EffectStop = () => void;

export function effect(fn: () => void): EffectStop {
	const instance = createEffect(fn);
	let stopped = false;
	let detachFromScope: (() => void) | undefined;

	const scope = getCurrentScope();
	if (scope !== undefined) {
		detachFromScope = registerScopeCleanup(() => stop(), scope);
	}

	function stop() {
		if (stopped) {
			return;
		}
		stopped = true;
		detachFromScope?.();
		instance.stop();
	}

	return stop;
}
