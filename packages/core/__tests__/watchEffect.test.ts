import { describe, expect, it } from "vitest";

import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { signal } from "../signal";
import { watchEffect } from "../watchEffect";

describe("watchEffect", () => {
	it("runs effect reactively until stopped", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			// access reactive dependency
			count.value;
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		stop();
		count.value = 2;
		expect(runs).toBe(2);
	});

	it("tears down automatically when enclosing scope unmounts", () => {
		const count = signal(0);
		let runs = 0;

		const scope = onMount(() => {
			watchEffect(() => {
				runs += 1;
				count.value;
			});

			onUnmount(() => {
				runs += 100;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		onUnmount(scope);
		expect(runs).toBe(102);

		count.value = 2;
		expect(runs).toBe(102);
	});
});
