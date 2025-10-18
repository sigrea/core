import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import { keepMount, onMount, onUnmount, signal } from "./index";

describe("signal lifecycle", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("invokes mount callbacks when first subscriber appears", () => {
		const store = signal(1);
		let mounted = false;
		const order: string[] = [];

		onMount(store, () => {
			mounted = true;
			order.push("first");
		});

		onMount(store, () => {
			order.push("second");
		});

		const subscription = effect(() => {
			store.value;
		});

		expect(mounted).toBe(true);
		expect(order).toEqual(["first", "second"]);
		subscription.stop();
	});

	it("keeps invoking subsequent mount callbacks even if earlier ones throw", () => {
		const store = signal(1);
		const order: string[] = [];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		onMount(store, () => {
			order.push("first");
		});

		onMount(store, () => {
			throw new Error("boom");
		});

		onMount(store, () => {
			order.push("third");
		});

		const subscription = effect(() => {
			store.value;
		});

		expect(order).toEqual(["first", "third"]);
		expect(errorSpy).toHaveBeenCalledWith(
			"Mount callback error:",
			expect.any(Error),
		);

		subscription.stop();
		errorSpy.mockRestore();
	});

	it("throws when mount callback is not a function", () => {
		const store = signal(1);
		expect(() => onMount(store, null as unknown as () => void)).toThrow(
			"Mount callback must be a function",
		);
	});

	it("schedules cleanup roughly one second after last subscriber leaves", () => {
		const store = signal(1);
		const cleanup = vi.fn();

		onUnmount(store, cleanup);

		const subscription = effect(() => {
			store.value;
		});

		subscription.stop();
		expect(cleanup).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1000);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("cancels unmount timer when a new subscriber arrives", () => {
		const store = signal(1);
		const cleanup = vi.fn();

		onUnmount(store, cleanup);

		const first = effect(() => {
			store.value;
		});
		first.stop();

		vi.advanceTimersByTime(500);

		const second = effect(() => {
			store.value;
		});

		vi.advanceTimersByTime(1000);
		expect(cleanup).not.toHaveBeenCalled();

		second.stop();
		vi.runAllTimers();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("keepMount keeps the store mounted until released", () => {
		const store = signal(1);
		const cleanup = vi.fn();

		onUnmount(store, cleanup);
		const release = keepMount(store);

		const subscription = effect(() => {
			store.value;
		});
		subscription.stop();

		vi.runAllTimers();
		expect(cleanup).not.toHaveBeenCalled();

		release();
		vi.runAllTimers();
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposer prevents queued unmount callbacks from running", () => {
		const store = signal(1);
		const cleanup = vi.fn();

		const dispose = onUnmount(store, cleanup);

		const subscription = effect(() => {
			store.value;
		});

		dispose();
		subscription.stop();

		vi.runAllTimers();
		expect(cleanup).not.toHaveBeenCalled();
	});
});
