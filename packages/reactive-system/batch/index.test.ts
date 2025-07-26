import { describe, expect, it } from "vitest";
import {
  decrementBatchDepth,
  getBatchDepth,
  incrementBatchDepth,
} from "./index";

describe("reactive-system/batch", () => {
  describe("batch depth management", () => {
    it("starts with depth 0", () => {
      expect(getBatchDepth()).toBe(0);
    });

    it("increments and decrements batch depth", () => {
      expect(getBatchDepth()).toBe(0);

      incrementBatchDepth();
      expect(getBatchDepth()).toBe(1);

      incrementBatchDepth();
      expect(getBatchDepth()).toBe(2);

      decrementBatchDepth();
      expect(getBatchDepth()).toBe(1);

      decrementBatchDepth();
      expect(getBatchDepth()).toBe(0);
    });

    it("handles nested batches", () => {
      expect(getBatchDepth()).toBe(0);

      // Start outer batch
      incrementBatchDepth();
      expect(getBatchDepth()).toBe(1);

      // Start inner batch
      incrementBatchDepth();
      expect(getBatchDepth()).toBe(2);

      // End inner batch
      decrementBatchDepth();
      expect(getBatchDepth()).toBe(1);

      // End outer batch
      decrementBatchDepth();
      expect(getBatchDepth()).toBe(0);
    });

    it("returns new depth from decrementBatchDepth", () => {
      incrementBatchDepth();
      incrementBatchDepth();

      const newDepth1 = decrementBatchDepth();
      expect(newDepth1).toBe(1);
      expect(getBatchDepth()).toBe(1);

      const newDepth2 = decrementBatchDepth();
      expect(newDepth2).toBe(0);
      expect(getBatchDepth()).toBe(0);
    });

    it("allows depth to go negative (edge case)", () => {
      // This is an edge case that shouldn't happen in normal usage
      // but the implementation allows it
      decrementBatchDepth();
      expect(getBatchDepth()).toBe(-1);

      incrementBatchDepth();
      expect(getBatchDepth()).toBe(0);
    });
  });
});
