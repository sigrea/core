import { describe, expect, it, vi } from "vitest";

import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import { readonly } from "../readonly";
import { signal } from "../signal";
import { watch } from "../watch";

describe("readonly", () => {
	const suppressConsoleWarn = () =>
		vi.spyOn(console, "warn").mockImplementation(() => {});

	it("reflects source updates without exposing setter", () => {
		const count = signal(1);
		const view = readonly(count);

		expect(view.value).toBe(1);

		count.value = 3;
		expect(view.value).toBe(3);
	});

	it("throws when attempting to assign to value", () => {
		const count = signal(0);
		const view = readonly(count);

		expect(() => {
			// @ts-expect-error runtime guard
			view.value = 1;
		}).toThrow(TypeError);
	});

	it("acts as a signal source for watch", async () => {
		const count = signal(0);
		const view = readonly(count);
		const seen: number[] = [];

		const stop = watch(
			view,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		count.value = 1;
		await nextTick();

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("wraps deep signals and blocks nested mutations", () => {
		const warn = suppressConsoleWarn();
		try {
			const state = deepSignal({ nested: { count: 1 } });
			const view = readonly(state);

			expect(view.nested.count).toBe(1);
			state.nested.count = 2;
			expect(view.nested.count).toBe(2);

			// @ts-expect-error readonly proxy rejects writes
			view.nested.count = 3;
			expect(view.nested.count).toBe(2);
			expect(state.nested.count).toBe(2);
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});

	it("tracks readonly deep signal map entries", async () => {
		const map = deepSignal(new Map<string, number>());
		const view = readonly(map);
		const seen: Array<number | undefined> = [];

		const stop = watch(
			() => view.get("foo"),
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		map.set("foo", 1);
		await nextTick();
		map.set("foo", 2);
		await nextTick();
		map.delete("foo");
		await nextTick();

		expect(seen).toEqual([undefined, 1, 2, undefined]);

		stop();
	});

	it("tracks readonly deep signal map size", async () => {
		const map = deepSignal(new Map<string, number>());
		const view = readonly(map);
		const sizes: number[] = [];

		const stop = watch(
			() => view.size,
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

		expect(sizes).toEqual([0, 1, 2, 1]);

		stop();
	});
});
