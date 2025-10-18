import { beforeEach, describe, expect, it } from "vitest";
import {
	decrementBatchDepth,
	getBatchDepth,
	incrementBatchDepth,
} from "./index";

describe("reactive-system/batch", () => {
	beforeEach(() => {
		// Reset depth before each test to avoid cross-test interference
		while (getBatchDepth() > 0) {
			decrementBatchDepth();
		}
		while (getBatchDepth() < 0) {
			incrementBatchDepth();
		}
	});

	it("starts at depth 0", () => {
		expect(getBatchDepth()).toBe(0);
	});

	it("increments and decrements depth", () => {
		incrementBatchDepth();
		expect(getBatchDepth()).toBe(1);

		incrementBatchDepth();
		expect(getBatchDepth()).toBe(2);

		expect(decrementBatchDepth()).toBe(1);
		expect(getBatchDepth()).toBe(1);

		expect(decrementBatchDepth()).toBe(0);
		expect(getBatchDepth()).toBe(0);
	});

	it("supports nested batch sequences", () => {
		incrementBatchDepth();
		incrementBatchDepth();
		expect(getBatchDepth()).toBe(2);

		decrementBatchDepth();
		expect(getBatchDepth()).toBe(1);

		decrementBatchDepth();
		expect(getBatchDepth()).toBe(0);
	});

	it("does not underflow when decrementing at zero", () => {
		expect(getBatchDepth()).toBe(0);
		expect(decrementBatchDepth()).toBe(0);
		expect(getBatchDepth()).toBe(0);
	});
});
