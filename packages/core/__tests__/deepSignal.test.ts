import { describe, expect, it } from "vitest";

import { deepSignal } from "../deepSignal";
import { watch } from "../watch";

describe("deepSignal", () => {
	it("tracks nested property changes", () => {
		const state = deepSignal({ nested: { count: 0 } });
		let runs = 0;

		const stop = watch(
			() => state.nested.count,
			() => {
				runs += 1;
			},
		);

		state.nested.count = 1;
		expect(runs).toBe(1);

		stop();
	});

	it("reacts to array mutations", () => {
		const state = deepSignal({ items: [] as string[] });
		const lengths: number[] = [];

		const stop = watch(
			() => state.items.length,
			(value) => {
				lengths.push(value);
			},
			{ immediate: true },
		);

		state.items.push("a");
		state.items.push("b");

		expect(lengths).toEqual([0, 1, 2]);

		stop();
	});
});
