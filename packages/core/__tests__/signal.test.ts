import { describe, expect, it } from "vitest";

import { nextTick } from "../nextTick";
import { createScope, disposeScope, runWithScope } from "../scope";
import { signal } from "../signal";
import { watchEffect } from "../watchEffect";

describe("signal", () => {
	it("exposes .value getter/setter", () => {
		const count = signal(0);

		expect(count.value).toBe(0);

		count.value = 1;
		expect(count.value).toBe(1);
	});

	it("does not track dependencies when peek is used", async () => {
		const count = signal(1);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			count.peek();
		});

		expect(runs).toBe(1);

		count.value = 2;
		await nextTick();
		expect(runs).toBe(1);

		stop();
	});

	it("supports signals without initial value", () => {
		const maybe = signal<number>();

		expect(maybe.value).toBeUndefined();

		maybe.value = 5;
		expect(maybe.value).toBe(5);
	});

	it("registers effects created inside a scope", async () => {
		const count = signal(0);
		let runs = 0;

		const scope = createScope();
		runWithScope(scope, () => {
			watchEffect(() => {
				runs += 1;
				count.value;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		disposeScope(scope);

		count.value = 2;
		await nextTick();
		expect(runs).toBe(2);
	});

	it("ignores redundant assignments", async () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			count.value;
		});

		expect(runs).toBe(1);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		stop();
	});
});
