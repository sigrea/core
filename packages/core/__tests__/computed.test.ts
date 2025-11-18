import { describe, expect, it } from "vitest";

import { computed } from "../computed";
import { nextTick } from "../nextTick";
import { signal } from "../signal";
import { watchEffect } from "../watchEffect";

describe("computed", () => {
	it("derives values from signals", () => {
		const count = signal(2);
		const doubled = computed(() => count.value * 2);

		expect(doubled.value).toBe(4);

		count.value = 3;
		expect(doubled.value).toBe(6);
	});

	it("allows peek without tracking dependencies", async () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			doubled.peek();
		});

		expect(runs).toBe(1);

		count.value = 2;
		await nextTick();
		expect(runs).toBe(1);

		stop();
	});

	it("supports writable computed values", () => {
		const count = signal(2);
		const doubled = computed({
			get: () => count.value * 2,
			set: (next) => {
				count.value = next / 2;
			},
		});

		expect(doubled.value).toBe(4);
		doubled.value = 10;
		expect(count.value).toBe(5);
		expect(doubled.value).toBe(10);
	});

	it("throws when assigning to a readonly computed", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);

		expect(() => {
			doubled.value = 4;
		}).toThrow(TypeError);
	});

	it("allows undefined return values", () => {
		const maybe = computed<undefined>(() => undefined);

		expect(() => maybe.value).not.toThrow();
		expect(maybe.value).toBeUndefined();
	});
});
