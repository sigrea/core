import { describe, expect, it, vi } from "vitest";

import {
	createComputedHandler,
	createDeepSignalHandler,
	createSignalHandler,
} from ".";
import { computed } from "../../core/computed";
import { deepSignal } from "../../core/deepSignal";
import { signal } from "../../core/signal";

describe("createSignalHandler", () => {
	it("subscribes and updates snapshots for signals", () => {
		const count = signal(0);
		const handle = createSignalHandler(count);

		const first = handle.getSnapshot();
		expect(first.value).toBe(0);
		expect(first.version).toBe(0);

		const listener = vi.fn(() => {
			handle.getSnapshot();
		});
		const unsubscribe = handle.subscribe(listener);

		count.value = 1;
		expect(listener).toHaveBeenCalledTimes(1);
		const updated = handle.getSnapshot();
		expect(updated.value).toBe(1);
		expect(updated.version).toBe(1);

		unsubscribe();
		count.value = 2;
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("createComputedHandler", () => {
	it("tracks computed values", () => {
		const base = signal(2);
		const doubled = computed(() => base.value * 2);
		const handle = createComputedHandler(doubled);

		const snapshots: Array<{ value: number; version: number }> = [];
		const unsubscribe = handle.subscribe(() => {
			snapshots.push(handle.getSnapshot());
		});

		base.value = 3;
		expect(snapshots).toEqual([{ value: 6, version: 1 }]);

		base.value = 5;
		expect(snapshots).toEqual([
			{ value: 6, version: 1 },
			{ value: 10, version: 2 },
		]);

		unsubscribe();
	});
});

describe("createDeepSignalHandler", () => {
	it("tracks deep signal changes without cloning", () => {
		const state = deepSignal({ nested: { count: 0 } });
		const handle = createDeepSignalHandler(state);
		const first = handle.getSnapshot();
		expect(first.value).toBe(state);
		expect(first.version).toBe(0);

		const snapshots: Array<{
			value: { nested: { count: number } };
			version: number;
		}> = [];

		const unsubscribe = handle.subscribe(() => {
			snapshots.push(handle.getSnapshot());
		});

		state.nested.count = 1;
		state.nested.count = 2;

		expect(snapshots).toHaveLength(2);
		expect(snapshots[0].value).toBe(state);
		expect(snapshots[1].value).toBe(state);
		expect(snapshots.map((snapshot) => snapshot.version)).toEqual([1, 2]);
		expect(state.nested.count).toBe(2);

		unsubscribe();
	});
});
