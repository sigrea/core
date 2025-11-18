import { describe, expect, it } from "vitest";

import {
	computed,
	deepSignal,
	isComputed,
	isDeepSignal,
	isSignal,
	nextTick,
	pauseTracking,
	resumeTracking,
	signal,
	toValue,
	watchEffect,
} from "..";

describe("public exports", () => {
	it("exposes isSignal() and toValue() from the package entry", () => {
		const count = signal(1);
		const getter = () => 5;

		expect(isSignal(count)).toBe(true);
		expect(isSignal({ value: 1 })).toBe(false);
		expect(toValue(count)).toBe(1);
		expect(toValue(getter)).toBe(5);
	});

	it("exposes isComputed() and isDeepSignal() helpers", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		const state = deepSignal({ count: 0 });

		expect(isComputed(doubled)).toBe(true);
		expect(isComputed({})).toBe(false);
		expect(isDeepSignal(state)).toBe(true);
		expect(isDeepSignal({})).toBe(false);
	});

	it("exposes pauseTracking()/resumeTracking() helpers", async () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			pauseTracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			count.value;
			resumeTracking();
		});

		expect(runs).toBe(1);
		count.value = 1;
		await nextTick();
		expect(runs).toBe(1);
		stop();
	});
});
