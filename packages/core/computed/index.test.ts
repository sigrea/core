import { describe, expect, it } from "vitest";

import { computed } from ".";
import { effect } from "../effect";
import { signal } from "../signal";

describe("computed", () => {
	it("derives values from signals", () => {
		const count = signal(2);
		const doubled = computed(() => count.value * 2);

		expect(doubled.value).toBe(4);

		count.value = 3;
		expect(doubled.value).toBe(6);
	});

	it("allows peek without tracking dependencies", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		let runs = 0;

		const stop = effect(() => {
			runs += 1;
			doubled.peek();
		});

		expect(runs).toBe(1);

		count.value = 2;
		expect(runs).toBe(1);

		stop();
	});
});
