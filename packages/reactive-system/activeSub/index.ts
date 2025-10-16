import type { Subscriber } from "../core";

export let activeSub: Subscriber | undefined = undefined;

export function setActiveSub(sub: Subscriber | undefined): void {
	activeSub = sub;
}

export function getActiveSub(): Subscriber | undefined {
	return activeSub;
}
