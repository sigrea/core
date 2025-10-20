import { describe, expect, it } from "vitest";

import { watch, watchEffect } from ".";
import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { deepSignal } from "../deepSignal";
import { signal } from "../signal";

describe("watch", () => {
	it("invokes callback when source changes", () => {
		const count = signal(0);
		const seen: Array<[number | undefined, number | undefined]> = [];

		const stop = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
			},
			{ immediate: true },
		);

		count.value = 1;
		count.value = 2;

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[2, 1],
		]);

		stop();
	});

	it("supports once option", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watch(
			count,
			() => {
				runs += 1;
			},
			{ once: true },
		);

		count.value = 1;
		count.value = 2;

		expect(runs).toBe(1);

		stop();
	});

	it("tracks deep paths when requested", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			() => state.nested,
			() => {
				runs += 1;
			},
			{ deep: true, immediate: true },
		);

		state.nested.flag = true;

		expect(runs).toBe(2);

		stop();
	});

	it("cleans up automatically when scope is unmounted", () => {
		const count = signal(0);
		let runs = 0;

		const scope = onMount(() => {
			watch(
				count,
				() => {
					runs += 1;
				},
				{ immediate: true },
			);

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

	it("allows the stop handle to be called multiple times safely", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watch(
			count,
			() => {
				runs += 1;
			},
			{ immediate: true },
		);

		expect(runs).toBe(1);

		stop();
		expect(() => stop()).not.toThrow();

		count.value = 1;
		expect(runs).toBe(1);
	});

	it("accepts arrays containing deep signals", () => {
		const state = deepSignal({ count: 0 });
		const counts: number[] = [];

		const stop = watch(
			[state],
			([value]) => {
				counts.push(value.count);
			},
			{ immediate: true },
		);

		state.count = 1;
		state.count = 2;

		expect(counts).toEqual([0, 1, 2]);

		stop();
	});
});

describe("watchEffect", () => {
	it("runs effect and stops via returned disposer", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			count.value;
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		stop();
		count.value = 2;
		expect(runs).toBe(2);
	});

	it("allows watchEffect stop handle to be called repeatedly", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			count.value;
		});

		expect(runs).toBe(1);

		stop();
		expect(() => stop()).not.toThrow();

		count.value = 1;
		expect(runs).toBe(1);
	});
});
