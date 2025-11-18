import { describe, expect, it } from "vitest";

import { computed } from "../computed";
import {
	deepSignal,
	readonlyDeepSignal,
	shallowDeepSignal,
	toRawDeepSignal,
} from "../deepSignal";
import { markRaw } from "../markRaw";
import { nextTick } from "../nextTick";
import { signal } from "../signal";
import type { Signal } from "../signal";
import { watch } from "../watch";
import { watchEffect } from "../watchEffect";

describe("deepSignal", () => {
	it("tracks nested property changes", async () => {
		const state = deepSignal({ nested: { count: 0 } });
		let runs = 0;

		const stop = watch(
			() => state.nested.count,
			() => {
				runs += 1;
			},
		);

		state.nested.count = 1;
		await nextTick();
		expect(runs).toBe(1);

		stop();
	});

	it("reacts to array mutations", async () => {
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
		await nextTick();
		state.items.push("b");
		await nextTick();

		expect(lengths).toEqual([0, 1, 2]);

		stop();
	});

	it("observes custom class instances", async () => {
		class Counter {
			count = 0;
			lastUpdated = new Date(0);
		}

		const state = deepSignal(new Counter());
		const counts: number[] = [];
		const timestamps: number[] = [];

		const stopCount = watch(
			() => state.count,
			(value) => {
				counts.push(value ?? 0);
			},
			{ immediate: true },
		);

		const stopDates = watch(
			() => state.lastUpdated.getTime(),
			(value) => {
				timestamps.push(value ?? 0);
			},
			{ immediate: true },
		);

		state.count = 1;
		await nextTick();
		state.lastUpdated = new Date(1_000);
		await nextTick();

		expect(counts).toEqual([0, 1]);
		expect(timestamps).toEqual([0, 1_000]);

		stopCount();
		stopDates();
	});

	it("unwraps signals stored inside arrays", async () => {
		const count = signal(0);
		const list = deepSignal([count]);

		expect(list[0]).toBe(0);

		const seen: number[] = [];
		const stop = watch(
			() => list[0],
			(value) => {
				seen.push(value ?? 0);
			},
			{ immediate: true },
		);

		count.value = 1;
		await nextTick();
		expect(list[0]).toBe(1);

		list[0] = 5;
		await nextTick();
		expect(count.value).toBe(5);
		expect(list[0]).toBe(5);

		const replacement = signal(10);
		// @ts-expect-error Writing a signal into a proxied array is intentionally outside the typed API,
		// but runtime behavior should still unwrap the value for existing subscribers.
		list[0] = replacement;
		await nextTick();
		expect(list[0]).toBe(10);
		expect(replacement.value).toBe(10);

		expect(seen).toEqual([0, 1, 5, 10]);

		stop();
	});

	it("unwraps signals stored inside readonly deep signal arrays", () => {
		const count = signal(1);
		const source = deepSignal([count]);
		const view = readonlyDeepSignal(source);

		expect(view[0]).toBe(1);

		count.value = 2;
		expect(view[0]).toBe(2);

		source[0] = 5;
		expect(view[0]).toBe(5);
	});

	it("unwraps signals stored inside maps and syncs assignments", async () => {
		const count = signal(1);
		const map = deepSignal(new Map<string, Signal<number>>([["count", count]]));

		expect(map.get("count")).toBe(1);

		const seen: number[] = [];
		const stop = watch(
			() => map.get("count"),
			(value) => {
				seen.push(value ?? 0);
			},
			{ immediate: true },
		);

		count.value = 2;
		await nextTick();
		expect(map.get("count")).toBe(2);

		map.set("count", 3);
		await nextTick();
		expect(count.value).toBe(3);
		expect(map.get("count")).toBe(3);

		const replacement = signal(5);
		// @ts-expect-error Signals are unwrapped for callers, so setting a signal falls outside typings,
		// yet runtime behavior should continue to sync with the underlying signal value.
		map.set("count", replacement);
		await nextTick();
		expect(map.get("count")).toBe(5);
		expect(replacement.value).toBe(5);

		expect(seen).toEqual([1, 2, 3, 5]);

		stop();
	});

	it("unwraps signals stored inside readonly maps", () => {
		const count = signal(1);
		const map = readonlyDeepSignal(
			deepSignal(new Map<string, Signal<number>>([["count", count]])),
		);

		expect(map.get("count")).toBe(1);
		count.value = 3;
		expect(map.get("count")).toBe(3);
	});

	it("unwraps signals stored inside sets", () => {
		const count = signal(1);
		const set = deepSignal(new Set<Signal<number>>([count]));

		expect(Array.from(set.values())).toEqual([1]);

		count.value = 2;
		expect(Array.from(set.values())).toEqual([2]);
	});

	it("unwraps signals stored inside readonly sets", () => {
		const count = signal(1);
		const set = readonlyDeepSignal(
			deepSignal(new Set<Signal<number>>([count])),
		);

		expect(Array.from(set.values())).toEqual([1]);
		count.value = 4;
		expect(Array.from(set.values())).toEqual([4]);
	});

	it("honors markRaw signals inside collections", () => {
		const raw = markRaw(signal(1));
		const map = deepSignal(new Map<string, Signal<number>>([["count", raw]]));
		const set = deepSignal(new Set<Signal<number>>([raw]));

		expect(map.get("count")).toBe(raw);
		expect(Array.from(set.values())[0]).toBe(raw);
	});

	it("reacts to map entry updates", async () => {
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
		await nextTick();
		state.map.delete("count");
		await nextTick();

		expect(values).toEqual([1, 2, undefined]);

		stop();
	});

	it("tracks map iteration via keys", async () => {
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
		await nextTick();
		map.delete("a");
		await nextTick();

		expect(snapshots).toEqual([["a"], ["a", "b"], ["b"]]);

		stop();
	});

	it("does not rerun key watchers when only values change", async () => {
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
		await nextTick();

		expect(snapshots).toEqual([["a"]]);

		map.set("b", 3);
		await nextTick();

		expect(snapshots).toEqual([["a"], ["a", "b"]]);

		stop();
	});

	it("updates map values iteration when entries change", async () => {
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
		await nextTick();

		expect(values).toEqual([[1], [2]]);

		stop();
	});

	it("reacts to set mutations via iteration", async () => {
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
		await nextTick();
		set.delete(1);
		await nextTick();

		expect(history).toEqual([[1], [1, 2], [2]]);

		stop();
	});

	it("matches raw and proxied entries during array searches", () => {
		const raw = { label: "base" };
		const list = deepSignal([raw]);
		const proxyEntry = list[0];

		expect(list.includes(raw)).toBe(true);
		expect(list.includes(proxyEntry)).toBe(true);
		expect(list.indexOf(proxyEntry)).toBe(0);
		expect(list.lastIndexOf(raw)).toBe(0);
	});

	it("does not track array length while running mutating effects", async () => {
		const list = deepSignal<number[]>([]);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			list.push(runs);
		});

		await nextTick();
		expect(runs).toBe(1);
		expect(list.length).toBe(1);

		stop();
	});

	it("supports deep signals on typed arrays", async () => {
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
		await nextTick();

		expect(observed).toEqual([0, 5]);

		stop();
	});

	it("tracks weak map entries", async () => {
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
		await nextTick();

		expect(results).toEqual([1, 3]);

		stop();
	});

	it("exposes the original object via toRawDeepSignal", () => {
		const original = { count: 0 };
		const state = deepSignal(original);
		state.count = 1;
		expect(toRawDeepSignal(state)).toBe(original);
		expect(toRawDeepSignal(state).count).toBe(1);
	});

	it("lets map entries be unwrapped when needed", () => {
		const map = deepSignal(new Map<string, { value: number }>());
		const payload = { value: 1 };
		map.set("foo", payload);
		const entry = map.get("foo");
		expect(entry?.value).toBe(1);
		expect(toRawDeepSignal(entry)).toBe(payload);
	});

	it("tracks map size mutations via the size getter", async () => {
		const map = deepSignal(new Map<string, number>());
		const sizes: number[] = [];

		const stop = watch(
			() => map.size,
			(value) => {
				sizes.push(value);
			},
			{ immediate: true },
		);

		map.set("a", 1);
		await nextTick();
		map.set("b", 2);
		await nextTick();
		map.delete("a");
		await nextTick();
		map.clear();
		await nextTick();

		expect(sizes).toEqual([0, 1, 2, 1, 0]);

		stop();
	});

	it("reacts to nested map value mutations observed through iteration", async () => {
		const map = deepSignal(
			new Map<string, { value: number }>([["foo", { value: 0 }]]),
		);
		const snapshots: number[][] = [];

		const stop = watch(
			() => Array.from(map.values()).map((entry) => entry.value),
			(values) => {
				snapshots.push([...values]);
			},
			{ immediate: true },
		);

		const foo = map.get("foo");
		if (foo == null) {
			throw new Error("expected foo entry to exist");
		}
		foo.value = 2;
		await nextTick();
		map.set("bar", { value: 5 });
		await nextTick();

		expect(snapshots).toEqual([[0], [2], [2, 5]]);

		stop();
	});

	it("tracks entries inserted into a raw map before being wrapped", async () => {
		const raw = new Map<object, number>();
		const key = {};
		raw.set(key, 1);
		const map = deepSignal(raw);
		const values: Array<number | undefined> = [];

		const stop = watch(
			() => map.get(key),
			(value) => {
				values.push(value);
			},
			{ immediate: true },
		);

		map.set(key, 2);
		await nextTick();
		map.delete(key);
		await nextTick();

		expect(values).toEqual([1, 2, undefined]);

		stop();
	});

	it("tracks set membership through has()", async () => {
		const set = deepSignal(new Set<number>());
		const seen: boolean[] = [];

		const stop = watch(
			() => set.has(1),
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		set.add(1);
		await nextTick();
		set.delete(1);
		await nextTick();

		expect(seen).toEqual([false, true, false]);

		stop();
	});

	it("unwraps nested signals and keeps them in sync", async () => {
		const count = signal(1);
		const state = deepSignal({ count });
		const seen: number[] = [];

		const stop = watch(
			() => state.count,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		count.value = 2;
		await nextTick();
		state.count = 3;
		await nextTick();

		expect(seen).toEqual([1, 2, 3]);
		expect(count.value).toBe(3);

		stop();
	});

	it("mirrors nested computed values and delegates assignments", async () => {
		const count = signal(1);
		const total = computed({
			get: () => count.value * 2,
			set: (value: number) => {
				count.value = value / 2;
			},
		});
		const state = deepSignal({ total });

		expect(state.total).toBe(2);

		count.value = 3;
		await nextTick();
		expect(state.total).toBe(6);

		state.total = 10;
		await nextTick();
		expect(count.value).toBe(5);
		expect(state.total).toBe(10);
	});

	it("throws when assigning to nested readonly computed values", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		const state = deepSignal({ doubled });

		expect(state.doubled).toBe(2);

		expect(() => {
			state.doubled = 4;
		}).toThrow(TypeError);
	});

	it("shallow deep signals only react to root-level assignments", async () => {
		const state = shallowDeepSignal({ nested: { flag: false } });
		const snapshots: Array<{ flag: boolean }> = [];

		const stop = watch(
			() => state.nested,
			(value) => {
				snapshots.push(value);
			},
			{ immediate: true },
		);

		state.nested.flag = true;
		await nextTick();
		expect(snapshots).toHaveLength(1);

		state.nested = { flag: false };
		await nextTick();
		expect(snapshots).toHaveLength(2);
		expect(snapshots[1]).toEqual({ flag: false });

		stop();
	});

	it("shallow deep signals expose child signals", async () => {
		const count = signal(0);
		const state = shallowDeepSignal({ count });
		expect(state.count).toBe(count);

		const seen: number[] = [];
		const stop = watch(
			() => state.count.value,
			(value) => {
				seen.push(value ?? 0);
			},
			{ immediate: true },
		);

		count.value = 1;
		await nextTick();

		const replacement = signal(5);
		state.count = replacement;
		await nextTick();

		replacement.value = 6;
		await nextTick();

		expect(seen).toEqual([0, 1, 5, 6]);
		expect(state.count).toBe(replacement);

		stop();
	});

	it("skips markRaw objects without creating proxies", async () => {
		const raw = markRaw({ count: 0 });
		const proxied = deepSignal(raw);
		expect(proxied).toBe(raw);

		let runs = 0;
		const stop = watch(
			() => proxied.count,
			() => {
				runs += 1;
			},
			{ immediate: true },
		);

		raw.count = 1;
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("wraps top-level Date instances without throwing", () => {
		const original = new Date(0);
		const proxy = deepSignal(original);
		expect(proxy).toBe(original);
		expect(toRawDeepSignal(proxy)).toBe(original);
		expect(proxy.getTime()).toBe(0);
		proxy.setTime(1_000);
		expect(proxy.getTime()).toBe(1_000);
		expect(original.getTime()).toBe(1_000);
	});
});
