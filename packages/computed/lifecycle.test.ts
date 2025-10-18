import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import { keepMount, onMount, onUnmount } from "../lifecycle";
import { signal } from "../signal";
import { computed } from "./index";

describe("computed lifecycle helpers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("invokes onMount callback when first subscriber attaches", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		let mounted = false;

		onMount(doubled, () => {
			mounted = true;
		});

		const subscription = effect(() => {
			doubled.value;
		});

		expect(mounted).toBe(true);
		subscription.stop();
	});

	it("throws when onMount receives non-function callback", () => {
		const doubled = computed(() => 1);
		expect(() => onMount(doubled, null as unknown as () => void)).toThrow(
			"Mount callback must be a function",
		);
	});

	it("delays unmount by roughly one second", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const cleanup = vi.fn();

		onUnmount(doubled, cleanup);

		const subscription = effect(() => {
			doubled.value;
		});

		subscription.stop();
		expect(cleanup).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("keepMount prevents unmount until released", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const cleanup = vi.fn();

		onUnmount(doubled, cleanup);

		const release = keepMount(doubled);

		const subscription = effect(() => {
			doubled.value;
		});
		subscription.stop();

		vi.runAllTimers();
		expect(cleanup).not.toHaveBeenCalled();

		release();
		vi.runAllTimers();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposer prevents unmount callback from firing after unsubscribe", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const cleanup = vi.fn();

		const dispose = onUnmount(doubled, cleanup);

		const subscription = effect(() => {
			doubled.value;
		});

		dispose();
		subscription.stop();

		vi.runAllTimers();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it("replaces previous mount cleanup when remounted", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const cleanupOrder: number[] = [];

		let cleanupId = 0;
		onMount(doubled, () => {
			const id = cleanupId++;
			return () => {
				cleanupOrder.push(id);
			};
		});

		const first = effect(() => {
			doubled.value;
		});

		first.stop();
		vi.runAllTimers();

		const second = effect(() => {
			doubled.value;
		});

		second.stop();
		vi.runAllTimers();

		expect(cleanupOrder).toEqual([0, 1]);
	});

	it("waits for all subscribers to detach before running unmount cleanup", () => {
		const source = signal(1);
		const doubled = computed(() => source.value * 2);
		const cleanup = vi.fn();

		onUnmount(doubled, cleanup);

		const first = effect(() => {
			doubled.value;
		});
		const second = effect(() => {
			doubled.value;
		});

		first.stop();
		vi.advanceTimersByTime(1000);
		expect(cleanup).not.toHaveBeenCalled();

		second.stop();
		vi.advanceTimersByTime(1000);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});
