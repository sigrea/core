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

	it("reacts to map entry updates", () => {
		const state = deepSignal({ map: new Map<string, number>() });
		state.map.set("count", 1);
		const values: Array<number | undefined> = [];

		const stop = watch(
			() => state.map.get("count"),
			(value) => {
				values.push(value);
			},
			{ immediate: true },
		);

		state.map.set("count", 2);
		state.map.delete("count");

		expect(values).toEqual([1, 2, undefined]);

		stop();
	});

	it("tracks map iteration via keys", () => {
		const map = deepSignal(new Map<string, string>([["a", "1"]]));
		const snapshots: string[][] = [];

		const stop = watch(
			() => Array.from(map.keys()),
			(value) => {
				snapshots.push(value);
			},
			{ immediate: true },
		);

		map.set("b", "2");
		map.delete("a");

		expect(snapshots).toEqual([["a"], ["a", "b"], ["b"]]);

		stop();
	});

	it("does not rerun key watchers when only values change", () => {
		const map = deepSignal(new Map<string, number>([["a", 1]]));
		const snapshots: string[][] = [];

		const stop = watch(
			() => Array.from(map.keys()),
			(value) => {
				snapshots.push(value);
			},
			{ immediate: true },
		);

		map.set("a", 2);

		expect(snapshots).toEqual([["a"]]);

		map.set("b", 3);

		expect(snapshots).toEqual([["a"], ["a", "b"]]);

		stop();
	});

	it("updates map values iteration when entries change", () => {
		const map = deepSignal(new Map<string, number>([["a", 1]]));
		const values: number[][] = [];

		const stop = watch(
			() => Array.from(map.values()),
			(snapshot) => {
				values.push(snapshot);
			},
			{ immediate: true },
		);

		map.set("a", 2);

		expect(values).toEqual([[1], [2]]);

		stop();
	});

	it("reacts to set mutations via iteration", () => {
		const set = deepSignal(new Set<number>([1]));
		const history: number[][] = [];

		const stop = watch(
			() => Array.from(set),
			(value) => {
				history.push(value);
			},
			{ immediate: true },
		);

		set.add(2);
		set.delete(1);

		expect(history).toEqual([[1], [1, 2], [2]]);

		stop();
	});

	it("supports deep signals on typed arrays", () => {
		const data = deepSignal(new Uint8Array([0, 1]));
		const observed: number[] = [];

		const stop = watch(
			() => data[0],
			(value) => {
				observed.push(value ?? 0);
			},
			{ immediate: true },
		);

		data[0] = 5;

		expect(observed).toEqual([0, 5]);

		stop();
	});

	it("tracks weak map entries", () => {
		const key = {};
		const weak = deepSignal(new WeakMap<object, number>());
		weak.set(key, 1);
		const results: Array<number | undefined> = [];

		const stop = watch(
			() => weak.get(key),
			(value) => {
				results.push(value);
			},
			{ immediate: true },
		);

		weak.set(key, 3);

		expect(results).toEqual([1, 3]);

		stop();
	});
});
