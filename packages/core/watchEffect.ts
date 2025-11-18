import { watch } from "./watch";
import type {
	DebuggerHook,
	WatchEffect,
	WatchFlushType,
	WatchStopHandle,
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
): WatchStopHandle {
	return watch(effect, undefined, options);
}
