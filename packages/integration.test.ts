import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  asyncComputed,
  computed,
  effect,
  endBatch,
  readonly,
  signal,
  startBatch,
  watch,
} from "./";

describe("Integration tests", () => {
  describe("Signal, Computed, Effect coordination", () => {
    it("complex dependency graph updates correctly", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const sum = computed(() => a.value + b.value);
      const product = computed(() => sum.value * c.value);
      const final = computed(() => product.value + sum.value);

      let effectCalls = 0;
      let lastValue = 0;
      const e = effect(() => {
        effectCalls++;
        lastValue = final.value;
      });

      expect(effectCalls).toBe(1);
      expect(lastValue).toBe(12);

      a.value = 2;
      expect(effectCalls).toBe(2);
      expect(lastValue).toBe(16);

      e.stop();
    });

    it("dynamic dependency graph with conditional branches", () => {
      const useA = signal(true);
      const a = signal(10);
      const b = signal(20);
      const c = signal(30);

      const selected = computed(() => (useA.value ? a.value : b.value));
      const result = computed(() => selected.value + c.value);

      expect(result.value).toBe(40);

      let computedCalls = 0;
      const tracker = computed(() => {
        computedCalls++;
        return result.value;
      });
      tracker.value;
      computedCalls = 0;

      b.value = 25;
      tracker.value;
      expect(computedCalls).toBe(0);

      useA.value = false;
      expect(result.value).toBe(55);
    });
  });

  describe("Batch processing with Watch/Effect coordination", () => {
    it("Watch and Effect work together in batch", () => {
      const s = signal(1);
      const double = computed(() => s.value * 2);

      const watchCalls: Array<{ newVal: number; oldVal: number }> = [];
      const effectCalls: number[] = [];

      const w = watch(double, (newVal, oldVal) => {
        watchCalls.push({ newVal, oldVal });
      });

      const e = effect(() => {
        effectCalls.push(double.value);
      });

      expect(watchCalls).toEqual([]);
      expect(effectCalls).toEqual([2]);

      startBatch();
      s.value = 2;
      s.value = 3;
      s.value = 4;
      endBatch();

      expect(watchCalls).toEqual([{ newVal: 8, oldVal: 2 }]);
      expect(effectCalls).toEqual([2, 8]);

      w.stop();
      e.stop();
    });
  });

  describe("AsyncComputed integration with other features", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("can transform AsyncComputed result with Computed", async () => {
      const multiplier = signal(2);
      const ac = asyncComputed(async () => {
        return 10;
      });

      const doubled = computed(() => {
        const value = ac.value.value;
        return value !== undefined ? value * multiplier.value : 0;
      });

      expect(doubled.value).toBe(0);

      await vi.runAllTimersAsync();
      expect(doubled.value).toBe(20);

      multiplier.value = 3;
      expect(doubled.value).toBe(30);

      ac.stop();
    });

    it("Watch monitors AsyncComputed and coordinates with Effect", async () => {
      const trigger = signal(1);
      const ac = asyncComputed(async () => {
        return trigger.value * 10;
      });

      const watchResults: number[] = [];
      const w = watch(ac, (newVal) => {
        watchResults.push(newVal);
      });

      let effectValue = 0;
      const e = effect(() => {
        effectValue = ac.loading.value ? -1 : (ac.value.value ?? 0);
      });

      expect(effectValue).toBe(-1);
      await vi.runAllTimersAsync();
      expect(effectValue).toBe(10);
      expect(watchResults).toEqual([]);

      trigger.value = 2;
      await vi.runAllTimersAsync();
      expect(effectValue).toBe(20);
      expect(watchResults).toEqual([20]);

      w.stop();
      e.stop();
      ac.stop();
    });
  });

  describe("Readonly and Computed chain", () => {
    it("can use readonly-wrapped Signal in Computed chain", () => {
      const original = signal(10);
      const readOnly = readonly(original);
      const doubled = computed(() => readOnly.value * 2);
      const quadrupled = computed(() => doubled.value * 2);

      expect(quadrupled.value).toBe(40);

      original.value = 20;
      expect(readOnly.value).toBe(20);
      expect(doubled.value).toBe(40);
      expect(quadrupled.value).toBe(80);
    });
  });

  describe("memory leak prevention", () => {
    it("stopped Effect/Watch is excluded from dependencies", () => {
      const s = signal(1);
      let effect1Calls = 0;
      let effect2Calls = 0;

      const e1 = effect(() => {
        effect1Calls++;
        s.value;
      });

      const e2 = effect(() => {
        effect2Calls++;
        s.value;
      });

      expect(effect1Calls).toBe(1);
      expect(effect2Calls).toBe(1);

      e1.stop();

      s.value = 2;
      expect(effect1Calls).toBe(1);
      expect(effect2Calls).toBe(2);

      e2.stop();
    });
  });

  describe("error recovery", () => {
    it("other Effects continue working when one Effect throws error", () => {
      const s = signal(1);
      let effect1Calls = 0;
      let effect2Calls = 0;
      let effect3Calls = 0;

      const e1 = effect(() => {
        effect1Calls++;
        if (s.value === 2) {
          throw new Error("Effect 1 error");
        }
      });

      const e2 = effect(() => {
        effect2Calls++;
        s.value;
      });

      expect(effect1Calls).toBe(1);
      expect(effect2Calls).toBe(1);

      try {
        s.value = 2;
      } catch (e) {}

      expect(effect1Calls).toBe(2);

      const e3 = effect(() => {
        effect3Calls++;
        s.value;
      });

      expect(effect3Calls).toBe(1);

      s.value = 3;
      expect(effect3Calls).toBe(2);

      e1.stop();
      e2.stop();
      e3.stop();
    });
  });

  describe("complex scenarios", () => {
    it("practical case combining all features", async () => {
      vi.useFakeTimers();

      const userId = signal(1);
      const includeDetails = signal(true);

      const userData = asyncComputed(async () => {
        const id = userId.value;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { id, name: `User ${id}`, score: id * 100 };
      });

      const displayData = computed(() => {
        const user = userData.value.value;
        if (!user) return "Loading...";

        if (includeDetails.value) {
          return `${user.name} (Score: ${user.score})`;
        }
        return user.name;
      });

      const updates: string[] = [];
      const e = effect(() => {
        updates.push(displayData.value);
      });

      expect(updates).toEqual(["Loading..."]);

      await vi.runAllTimersAsync();
      expect(updates).toEqual(["Loading...", "User 1 (Score: 100)"]);

      startBatch();
      includeDetails.value = false;
      userId.value = 2;
      endBatch();

      expect(updates).toEqual(["Loading...", "User 1 (Score: 100)", "User 1"]);

      await vi.runAllTimersAsync();
      expect(updates).toEqual([
        "Loading...",
        "User 1 (Score: 100)",
        "User 1",
        "User 2",
      ]);

      e.stop();
      userData.stop();
      vi.restoreAllMocks();
    });
  });
});
