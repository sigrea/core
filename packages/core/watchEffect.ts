import { watch } from "./watch";
import type {
	DebuggerHook,
	WatchEffect,
	WatchFlushType,
	WatchHandle,
} from "./watch";

export type { WatchEffect };

export interface WatchEffectOptions {
	flush?: WatchFlushType;
	onTrack?: DebuggerHook;
	onTrigger?: DebuggerHook;
}

export function watchEffect(
	effect: WatchEffect,
	options?: WatchEffectOptions,
): WatchHandle {
	return watch(effect, undefined, options);
}
