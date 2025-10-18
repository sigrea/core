import { describe, expect, it, vi } from "vitest";
import { computed } from "../computed";
import { effect } from "../effect";
import { isSignal, signal } from "./index";

describe("signal", () => {
	describe("value access", () => {
		it("returns the initial value", () => {
			const count = signal(1);
			expect(count.value).toBe(1);
		});

		it("updates stored value", () => {
			const count = signal(1);
			count.value = 2;
			expect(count.value).toBe(2);
		});
	});

	describe("reactivity", () => {
		it("updates dependent computed values", () => {
			const count = signal(2);
			const doubled = computed(() => count.value * 2);

			expect(doubled.value).toBe(4);
			count.value = 3;
			expect(doubled.value).toBe(6);
		});

		it("notifies effects when the value changes", () => {
			const count = signal(1);
			let latest = 0;

			const subscription = effect(() => {
				latest = count.value;
			});

			expect(latest).toBe(1);
			count.value = 5;
			expect(latest).toBe(5);

			subscription.stop();
		});

		it("skips propagation when assigning the same value", () => {
			const count = signal(1);
			let runs = 0;

			const watcher = computed(() => {
				runs += 1;
				return count.value;
			});

			expect(watcher.value).toBe(1);
			expect(runs).toBe(1);
			count.value = 1;
			expect(runs).toBe(1);

			// ensure watcher still works later
			count.value = 2;
			expect(watcher.value).toBe(2);
		});
	});

	describe("subscription tracking", () => {
		it("counts unique subscribers", () => {
			const count = signal(1);
			expect(count._listenerCount).toBe(0);

			const subscription = effect(() => {
				count.value;
				count.value;
			});

			expect(count._listenerCount).toBe(1);

			subscription.stop();
			expect(count._listenerCount).toBe(0);
		});
	});

	describe("type guards", () => {
		it("detects signal instances", () => {
			const count = signal(1);
			expect(isSignal(count)).toBe(true);
			expect(isSignal({})).toBe(false);
			expect(isSignal(undefined)).toBe(false);
		});
	});

	describe("lifecycle", () => {
		it("runs cleanup immediately when disposer is called while mounted", () => {
			vi.useFakeTimers();
			try {
				const store = signal(0);
				const cleanup = vi.fn();
				const dispose = store.onMount(() => cleanup);
				const watcher = effect(() => {
					store.value;
				});

				dispose();
				watcher.stop();

				expect(cleanup).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});
	});
});
