import { describe, expect, it, vi } from "vitest";
import { computed, effect, endBatch, signal, startBatch, watch } from "../..";

describe("Batch", () => {
  describe("basic batch processing", () => {
    it("executes Effect only once for multiple updates in batch", () => {
      const a = signal(1);
      const b = signal(2);
      let effectCalls = 0;
      let lastSum = 0;

      const e = effect(() => {
        effectCalls++;
        lastSum = a.value + b.value;
      });

      expect(effectCalls).toBe(1);
      expect(lastSum).toBe(3);

      startBatch();
      a.value = 10;
      b.value = 20;
      expect(effectCalls).toBe(1);
      endBatch();

      expect(effectCalls).toBe(2);
      expect(lastSum).toBe(30);

      e.stop();
    });

    it("Computed returns latest value even in batch", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a.value + b.value);

      expect(sum.value).toBe(3);

      startBatch();
      a.value = 10;
      expect(sum.value).toBe(12);
      b.value = 20;
      expect(sum.value).toBe(30);
      endBatch();
    });

    it("Watch is also batched", () => {
      const s = signal(1);
      const callback = vi.fn();
      const w = watch(s, callback);

      startBatch();
      s.value = 2;
      s.value = 3;
      s.value = 4;
      expect(callback).not.toHaveBeenCalled();
      endBatch();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(4, 1);

      w.stop();
    });
  });

  describe("nested batches", () => {
    it("nested batches execute when outermost batch ends", () => {
      const s = signal(1);
      let effectCalls = 0;

      const e = effect(() => {
        effectCalls++;
        s.value;
      });

      expect(effectCalls).toBe(1);

      startBatch();
      s.value = 2;
      expect(effectCalls).toBe(1);

      startBatch();
      s.value = 3;
      expect(effectCalls).toBe(1);
      endBatch();

      expect(effectCalls).toBe(1);

      s.value = 4;
      endBatch();

      expect(effectCalls).toBe(2);

      e.stop();
    });

    it("deeply nested batches are processed correctly", () => {
      const s = signal(1);
      let effectCalls = 0;

      const e = effect(() => {
        effectCalls++;
        s.value;
      });

      startBatch();
      startBatch();
      startBatch();
      s.value = 2;
      endBatch();
      endBatch();
      expect(effectCalls).toBe(1);
      endBatch();

      expect(effectCalls).toBe(2);

      e.stop();
    });
  });

  describe("error handling", () => {
    it("batch count is correctly managed even when error occurs", () => {
      const s = signal(1);
      let effectCalls = 0;

      const e = effect(() => {
        effectCalls++;
        if (s.value === 2) {
          throw new Error("Test error");
        }
      });

      startBatch();
      expect(() => {
        s.value = 2;
        endBatch();
      }).toThrow("Test error");

      s.value = 3;
      expect(effectCalls).toBe(3);

      e.stop();
    });
  });

  describe("complex scenarios", () => {
    it("multiple Effects execute in correct order", () => {
      const s = signal(1);
      const results: string[] = [];

      const e1 = effect(() => {
        results.push(`e1: ${s.value}`);
      });

      const e2 = effect(() => {
        results.push(`e2: ${s.value}`);
      });

      expect(results).toEqual(["e1: 1", "e2: 1"]);
      results.length = 0;

      startBatch();
      s.value = 2;
      s.value = 3;
      endBatch();

      expect(results).toEqual(["e1: 3", "e2: 3"]);

      e1.stop();
      e2.stop();
    });

    it("combination of Computed chain and Effect", () => {
      const s = signal(1);
      const double = computed(() => s.value * 2);
      const quadruple = computed(() => double.value * 2);
      let effectCalls = 0;
      let lastValue = 0;

      const e = effect(() => {
        effectCalls++;
        lastValue = quadruple.value;
      });

      expect(effectCalls).toBe(1);
      expect(lastValue).toBe(4);

      startBatch();
      s.value = 2;
      expect(double.value).toBe(4);
      expect(quadruple.value).toBe(8);
      s.value = 3;
      expect(double.value).toBe(6);
      expect(quadruple.value).toBe(12);
      endBatch();

      expect(effectCalls).toBe(2);
      expect(lastValue).toBe(12);

      e.stop();
    });
  });

  describe("empty batch", () => {
    it("empty batch is processed normally", () => {
      const s = signal(1);
      let effectCalls = 0;

      const e = effect(() => {
        effectCalls++;
        s.value;
      });

      expect(effectCalls).toBe(1);

      startBatch();
      endBatch();

      expect(effectCalls).toBe(1);

      e.stop();
    });
  });
});
