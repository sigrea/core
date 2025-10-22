import type { WatchEffect } from "alien-deepsignals";
import type { WatchStopHandle } from "./watch";
import { watch } from "./watch";

export type { WatchEffect };

export function watchEffect(effect: WatchEffect): WatchStopHandle {
	return watch(effect);
}
