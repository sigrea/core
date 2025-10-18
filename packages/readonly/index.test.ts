import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import type { Signal } from "../signal";
import { signal } from "../signal";
import { isReadonly, readonly } from "./index";

describe("readonly", () => {
	const invalidSignal = {} as unknown as Signal<number>;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("proxies value reads from the source signal", () => {
		const source = signal(1);
		const view = readonly(source);

		expect(view.value).toBe(1);
		source.value = 2;
		expect(view.value).toBe(2);
	});

	it("throws when attempting to write", () => {
		const source = signal(1);
		const view = readonly(source);

		expect(() => {
			Reflect.set(view as object, "value", 3);
		}).toThrow("Cannot set value on a readonly Signal");
	});

	it("delegates lifecycle hooks to the source", () => {
		const source = signal(1);
		const view = readonly(source);

		let mountCount = 0;

		const unsubscribe = view.onMount(() => {
			mountCount += 1;
		});

		const subscription = effect(() => {
			view.value;
		});

		expect(mountCount).toBe(1);
		expect(source._listenerCount).toBe(1);
		expect(view._listenerCount).toBe(1);

		subscription.stop();
		unsubscribe();
	});

	it("runs all mount callbacks registered via readonly view", () => {
		const source = signal(1);
		const view = readonly(source);

		const order: string[] = [];
		view.onMount(() => {
			order.push("first");
		});
		view.onMount(() => {
			order.push("second");
		});

		const watcher = effect(() => {
			view.value;
		});
		watcher.stop();

		expect(order).toEqual(["first", "second"]);
	});

	it("continues to mirror lifecycle after source unmounts", () => {
		const source = signal(1);
		const view = readonly(source);
		const cleanup = vi.fn();

		view.onUnmount(cleanup);

		const first = effect(() => {
			view.value;
		});

		first.stop();
		vi.advanceTimersByTime(1000);
		expect(cleanup).toHaveBeenCalledTimes(1);

		const second = effect(() => {
			view.value;
		});

		expect(view.value).toBe(1);
		expect(source._listenerCount).toBe(1);

		second.stop();
	});

	it("validates arguments", () => {
		expect(() => readonly(invalidSignal)).toThrow(
			"readonly can only be applied to a Signal",
		);
	});

	it("identifies readonly wrapper instances", () => {
		const source = signal(1);
		const view = readonly(source);

		expect(isReadonly(view)).toBe(true);
		expect(isReadonly(source)).toBe(false);
	});
});
