import { watch } from "./watch";
import type { WatchEffect, WatchStopHandle } from "./watch";

export type { WatchEffect };

export function watchEffect(effect: WatchEffect): WatchStopHandle {
	return watch(effect);
}
