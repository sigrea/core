import { describe, expect, it } from "vitest";

import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { deepSignal } from "../deepSignal";
import { signal } from "../signal";
import { watch } from "../watch";

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

	it("tracks deep signals returned from object sources when deep is true", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			() => ({ nested: state.nested }),
			() => {
				runs += 1;
			},
			{ deep: true },
		);

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("does not react to nested deep signal changes when deep is false", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.nested.flag = true;

		expect(runs).toBe(0);

		stop();
	});

	it("does not react to nested deep signal entries in source arrays when deep is false", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			[state],
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.nested.flag = true;

		expect(runs).toBe(0);

		stop();
	});

	it("does not react to nested deep signal changes by default", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.nested.flag = true;

		expect(runs).toBe(0);

		stop();
	});

	it("reacts to top-level deep signal changes by default", () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.count = 1;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to top-level deep signal changes even when deep is false", () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.count = 1;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to nested deep signal changes when using a finite depth", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: 1 },
		);

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("does not trigger callbacks when unrelated sources perform no-op writes", () => {
		const count = signal(0);
		const state = deepSignal({ flag: false });
		let runs = 0;

		const stop = watch([count, state], () => {
			runs += 1;
		});

		count.value = 0;
		expect(runs).toBe(0);

		state.flag = true;
		expect(runs).toBe(1);

		stop();
	});

	it("updates array length signals when adding elements via index assignment", () => {
		const state = deepSignal({ items: [] as number[] });
		const lengths: number[] = [];

		const stop = watch(
			() => state.items.length,
			(value) => {
				lengths.push(value);
			},
			{ immediate: true },
		);

		state.items[state.items.length] = 42;

		expect(lengths).toEqual([0, 1]);

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
