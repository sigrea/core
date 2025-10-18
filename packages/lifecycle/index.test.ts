import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Computed } from "../computed";
import { computed } from "../computed";
import { effect } from "../effect";
import type { Signal } from "../signal";
import { signal } from "../signal";
import { keepMount, onMount, onUnmount } from "./index";

describe("lifecycle helpers", () => {
	const invalidStore = {} as unknown as Signal<unknown>;
	const invalidComputed = {} as unknown as Computed<unknown>;

	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("throws when provided value is not signal or computed", () => {
		expect(() => onMount(invalidStore, () => {})).toThrow(
			"onMount can only be called on a Signal or Computed instance.",
		);
		expect(() => onUnmount(invalidComputed, () => {})).toThrow(
			"onUnmount can only be called on a Signal or Computed instance.",
		);
		expect(() => keepMount(invalidStore)).toThrow(
			"keepMount can only be called on a Signal or Computed instance.",
		);
	});

	it("delegates lifecycle helpers to Signal instances", () => {
		const store = signal(1);
		const mount = vi.fn();
		const unmount = vi.fn();

		onMount(store, mount);
		onUnmount(store, unmount);

		const watcher = effect(() => {
			store.value;
		});

		expect(mount).toHaveBeenCalledTimes(1);

		watcher.stop();
		vi.advanceTimersByTime(1000);

		expect(unmount).toHaveBeenCalledTimes(1);
	});

	it("delegates lifecycle helpers to Computed instances", () => {
		const source = signal(1);
		const store = computed(() => source.value * 2);
		const mount = vi.fn();
		const unmount = vi.fn();

		onMount(store, mount);
		onUnmount(store, unmount);

		const watcher = effect(() => {
			store.value;
		});

		expect(mount).toHaveBeenCalledTimes(1);

		watcher.stop();
		vi.advanceTimersByTime(1000);

		expect(unmount).toHaveBeenCalledTimes(1);
	});

	it("keeps stores mounted until release when using keepMount", () => {
		const store = signal(1);
		const cleanup = vi.fn();

		onUnmount(store, cleanup);

		const release = keepMount(store);

		vi.runAllTimers();
		expect(cleanup).not.toHaveBeenCalled();

		release();
		vi.advanceTimersByTime(1000);
		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});
