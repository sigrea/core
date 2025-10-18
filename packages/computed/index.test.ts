import { describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import { getActiveSub } from "../reactive-system";
import { onUnmount as onSignalUnmount, signal } from "../signal";
import { computed, isComputed } from "./index";

describe("computed", () => {
	describe("lazy evaluation", () => {
		it("defers getter execution until value is read", () => {
			let calls = 0;
			const base = signal(1);
			const doubled = computed(() => {
				calls += 1;
				return base.value * 2;
			});

			expect(calls).toBe(0);
			expect(doubled.value).toBe(2);
			expect(calls).toBe(1);
		});

		it("caches value until dependencies change", () => {
			let calls = 0;
			const base = signal(1);
			const doubled = computed(() => {
				calls += 1;
				return base.value * 2;
			});

			expect(doubled.value).toBe(2);
			expect(calls).toBe(1);
			expect(doubled.value).toBe(2);
			expect(calls).toBe(1);

			base.value = 2;
			expect(doubled.value).toBe(4);
			expect(calls).toBe(2);
		});
	});

	describe("dependency tracking", () => {
		it("tracks dynamic dependencies", () => {
			const usePrimary = signal(true);
			const primary = signal(1);
			const fallback = signal(2);

			const value = computed(() =>
				usePrimary.value ? primary.value : fallback.value,
			);

			expect(value.value).toBe(1);
			fallback.value = 3;
			expect(value.value).toBe(1);

			usePrimary.value = false;
			expect(value.value).toBe(3);
		});

		it("can depend on other computed values", () => {
			const count = signal(1);
			const doubled = computed(() => count.value * 2);
			const quadrupled = computed(() => doubled.value * 2);

			expect(quadrupled.value).toBe(4);
			count.value = 2;
			expect(quadrupled.value).toBe(8);
		});
	});

	describe("integration with effects", () => {
		it("notifies effects when value changes", () => {
			const count = signal(1);
			const doubled = computed(() => count.value * 2);
			let latest = 0;

			const watcher = effect(() => {
				latest = doubled.value;
			});

			expect(latest).toBe(2);

			count.value = 3;
			expect(latest).toBe(6);

			watcher.stop();
		});
	});

	describe("type guard", () => {
		it("identifies computed instances", () => {
			const count = signal(1);
			const doubled = computed(() => count.value * 2);

			expect(isComputed(doubled)).toBe(true);
			expect(isComputed(count)).toBe(false);
		});
	});

	describe("lifecycle", () => {
		it("does not run cleanup after disposer is called", () => {
			vi.useFakeTimers();
			try {
				const source = signal(1);
				const value = computed(() => source.value * 2);
				const cleanup = vi.fn();
				const dispose = value.onMount(() => cleanup);

				const watcher = effect(() => {
					value.value;
				});

				dispose();
				watcher.stop();
				vi.runAllTimers();

				expect(cleanup).not.toHaveBeenCalled();
			} finally {
				vi.useRealTimers();
			}
		});

		it("marks computed dirty after unmounting so remount recomputes", () => {
			vi.useFakeTimers();
			try {
				const source = signal(1);
				const value = computed(() => source.value * 2);

				let latest = 0;
				const watcher = effect(() => {
					latest = value.value;
				});

				expect(latest).toBe(2);

				watcher.stop();
				vi.runAllTimers(); // trigger unmount after grace period

				source.value = 5;

				let remounted = 0;
				const watcher2 = effect(() => {
					remounted = value.value;
				});

				expect(remounted).toBe(10);

				watcher2.stop();
			} finally {
				vi.useRealTimers();
			}
		});

		it("cleans up switched dependencies before delayed unmount finishes", () => {
			vi.useFakeTimers();
			try {
				const usePrimary = signal(true);
				const primary = signal(1);
				const fallback = signal(2);

				const primaryCleanup = vi.fn();
				const fallbackCleanup = vi.fn();

				onSignalUnmount(primary, primaryCleanup);
				onSignalUnmount(fallback, fallbackCleanup);

				const value = computed(() =>
					usePrimary.value ? primary.value : fallback.value,
				);

				const watcher = effect(() => {
					value.value;
				});

				watcher.stop();

				usePrimary.value = false;
				value.value;

				vi.advanceTimersByTime(1000);
				expect(primaryCleanup).toHaveBeenCalledTimes(1);
				expect(fallbackCleanup).not.toHaveBeenCalled();

				vi.advanceTimersByTime(1000);
				expect(fallbackCleanup).toHaveBeenCalledTimes(1);
			} finally {
				vi.useRealTimers();
			}
		});
	});

	describe("error handling", () => {
		it("restores tracking context when getter throws", () => {
			const source = signal(1);
			const value = computed(() => {
				const current = source.value;
				if (current === 1) {
					throw new Error("boom");
				}
				return current * 2;
			});

			const before = getActiveSub();
			expect(() => value.value).toThrow("boom");
			expect(getActiveSub()).toBe(before);

			source.value = 2;
			expect(value.value).toBe(4);
		});
	});
});
