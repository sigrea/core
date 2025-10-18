import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as reactive from "../reactive-system";
import { batch, endBatch, startBatch } from "./index";

describe("batch helpers", () => {
	beforeEach(() => {
		while (reactive.getBatchDepth() > 0) {
			endBatch();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
		while (reactive.getBatchDepth() > 0) {
			endBatch();
		}
	});

	it("increments batch depth", () => {
		const before = reactive.getBatchDepth();
		startBatch();
		expect(reactive.getBatchDepth()).toBe(before + 1);
		endBatch();
	});

	it("flushes notifications when outermost batch ends", () => {
		const flush = vi.spyOn(reactive, "processEffectNotifications");
		startBatch();
		endBatch();
		expect(flush).toHaveBeenCalledTimes(1);
	});

	it("does not flush when nested batch remains active", () => {
		const flush = vi.spyOn(reactive, "processEffectNotifications");
		startBatch();
		startBatch();

		endBatch();
		expect(flush).not.toHaveBeenCalled();

		endBatch();
	});

	it("throws when endBatch is called without startBatch", () => {
		expect(() => endBatch()).toThrowError(
			"endBatch called without a matching startBatch()",
		);
	});

	it("wraps execution safely with batch helper", () => {
		const flush = vi.spyOn(reactive, "processEffectNotifications");
		const result = batch(() => {
			expect(reactive.getBatchDepth()).toBe(1);
			return 42;
		});

		expect(result).toBe(42);
		expect(flush).toHaveBeenCalledTimes(1);
	});

	it("ensures endBatch runs even if the callback throws", () => {
		const flush = vi.spyOn(reactive, "processEffectNotifications");

		expect(() =>
			batch(() => {
				throw new Error("boom");
			}),
		).toThrow("boom");

		expect(reactive.getBatchDepth()).toBe(0);
		expect(flush).toHaveBeenCalledTimes(1);
	});
});
