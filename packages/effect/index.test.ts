import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endBatch, startBatch } from "../batch";
import { computed } from "../computed";
import type { Subscriber } from "../reactive-system";
import {
	SubscriberFlags,
	getActiveSub,
	setActiveSub,
} from "../reactive-system";
import { signal } from "../signal";
import { onUnmount } from "../signal";
import { Effect, effect } from "./index";

describe("effect", () => {
	describe("construction", () => {
		it("runs immediately after creation", () => {
			let executed = false;
			const instance = effect(() => {
				executed = true;
			});

			expect(executed).toBe(true);
			instance.stop();
		});

		it("re-runs when dependent signal changes", () => {
			const count = signal(1);
			let runs = 0;
			let latest = 0;

			const instance = effect(() => {
				runs += 1;
				latest = count.value;
			});

			expect(runs).toBe(1);
			expect(latest).toBe(1);

			count.value = 2;
			expect(runs).toBe(2);
			expect(latest).toBe(2);

			instance.stop();
		});
	});

	describe("dirty notification", () => {
		it("invokes run() when notify() sees Dirty flag", () => {
			const runner = vi.fn();
			const instance = new Effect(runner);

			instance.flags |= SubscriberFlags.Dirty;
			instance.notify();

			expect(runner).toHaveBeenCalledTimes(1);
		});

		it("re-runs when computed dependency invalidates", () => {
			const source = signal(1);
			const doubled = computed(() => source.value * 2);
			let runs = 0;

			const instance = effect(() => {
				runs += 1;
				return doubled.value;
			});

			expect(runs).toBe(1);
			source.value = 2;
			expect(runs).toBe(2);

			instance.stop();
		});
	});

	describe("cleanup", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("stops reacting after stop()", () => {
			const source = signal(1);
			let runs = 0;

			const instance = effect(() => {
				runs += 1;
				source.value;
			});

			expect(runs).toBe(1);
			instance.stop();

			source.value = 2;
			expect(runs).toBe(1);
		});

		it("untracks dependencies so lifecycle cleanup runs", () => {
			const source = signal(1);
			const cleanup = vi.fn();

			onUnmount(source, cleanup);

			const instance = effect(() => {
				source.value;
			});

			instance.stop();
			vi.runAllTimers();

			expect(cleanup).toHaveBeenCalledTimes(1);
		});

		it("does not rerun when stopped while dirty inside a batch", () => {
			const source = signal(1);
			let runs = 0;

			const instance = effect(() => {
				runs += 1;
				source.value;
			});

			expect(runs).toBe(1);

			startBatch();
			source.value = 2;
			expect(runs).toBe(1);

			instance.stop();
			endBatch();

			expect(runs).toBe(1);
		});
	});

	it("restores previous active subscriber when the effect throws", () => {
		const previous = getActiveSub();
		const sentinel: Subscriber = {
			flags: SubscriberFlags.Effect,
			deps: undefined,
			depsTail: undefined,
		};

		setActiveSub(sentinel);

		const instance = new Effect(() => {
			throw new Error("boom");
		});

		expect(() => instance.run()).toThrow("boom");
		expect(getActiveSub()).toBe(sentinel);

		setActiveSub(previous);
	});
});
