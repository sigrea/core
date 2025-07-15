import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asyncComputed, effect, isAsyncComputed, signal } from "../..";

describe("AsyncComputed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("basic async processing", () => {
    it("holds async function result", async () => {
      const ac = asyncComputed(async () => {
        return "hello";
      });

      expect(ac.loading.value).toBe(true);
      expect(ac.value.value).toBe(undefined);
      expect(ac.error.value).toBe(null);

      await vi.runAllTimersAsync();

      expect(ac.loading.value).toBe(false);
      expect(ac.value.value).toBe("hello");
      expect(ac.error.value).toBe(null);

      ac.stop();
    });

    it("can set initial value", async () => {
      const ac = asyncComputed(
        async () => {
          return "world";
        },
        { initialValue: "hello" },
      );

      expect(ac.value.value).toBe("hello");
      expect(ac.loading.value).toBe(true);

      await vi.runAllTimersAsync();

      expect(ac.value.value).toBe("world");
      expect(ac.loading.value).toBe(false);

      ac.stop();
    });

    it("catches and holds errors", async () => {
      const error = new Error("Test error");
      const onError = vi.fn();

      const ac = asyncComputed(
        async () => {
          throw error;
        },
        { onError },
      );

      await vi.runAllTimersAsync();

      expect(ac.loading.value).toBe(false);
      expect(ac.value.value).toBe(undefined);
      expect(ac.error.value).toBe(error);
      expect(onError).toHaveBeenCalledWith(error);

      ac.stop();
    });
  });

  describe("dependency tracking", () => {
    it("re-executes when dependent Signal changes", async () => {
      const s = signal(10);
      let calls = 0;

      const ac = asyncComputed(async () => {
        calls++;
        return s.value * 2;
      });

      await vi.runAllTimersAsync();
      expect(calls).toBe(1);
      expect(ac.value.value).toBe(20);

      s.value = 20;
      await vi.runAllTimersAsync();
      expect(calls).toBe(2);
      expect(ac.value.value).toBe(40);

      ac.stop();
    });

    it("starts new execution when dependencies change", async () => {
      const s = signal(1);
      let executionCount = 0;

      const ac = asyncComputed(async () => {
        executionCount++;
        const val = s.value;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return val;
      });

      await vi.runAllTimersAsync();
      expect(executionCount).toBe(1);
      expect(ac.value.value).toBe(1);

      s.value = 2;
      s.value = 3;
      s.value = 4;

      await vi.runAllTimersAsync();

      expect(executionCount).toBeGreaterThan(1);
      expect(ac.value.value).toBe(4);

      ac.stop();
    });
  });

  describe("manual refresh", () => {
    it("can re-execute with refresh()", async () => {
      let calls = 0;
      const ac = asyncComputed(async () => {
        calls++;
        return calls;
      });

      await vi.runAllTimersAsync();
      const firstValue = ac.value.value;
      expect(calls).toBe(1);
      expect(firstValue).toBe(1);

      await ac.refresh();
      const secondValue = ac.value.value;
      expect(calls).toBe(2);
      expect(secondValue).toBe(2);

      ac.stop();
    });

    it("correctly manages loading state during refresh()", async () => {
      const ac = asyncComputed(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "done";
      });

      await vi.runAllTimersAsync();
      expect(ac.loading.value).toBe(false);

      const refreshPromise = ac.refresh();
      expect(ac.loading.value).toBe(true);

      await vi.runAllTimersAsync();
      await refreshPromise;
      expect(ac.loading.value).toBe(false);

      ac.stop();
    });
  });

  describe("state consistency", () => {
    it("clears error during loading", async () => {
      let shouldError = true;
      const ac = asyncComputed(async () => {
        if (shouldError) {
          throw new Error("Test error");
        }
        return "success";
      });

      await vi.runAllTimersAsync();
      expect(ac.error.value).toBeInstanceOf(Error);
      expect(ac.loading.value).toBe(false);

      // エラーを発生させない
      shouldError = false;
      ac.refresh();

      expect(ac.loading.value).toBe(true);
      expect(ac.error.value).toBe(null);

      await vi.runAllTimersAsync();
      expect(ac.value.value).toBe("success");
      expect(ac.error.value).toBe(null);

      ac.stop();
    });
  });

  describe("cleanup", () => {
    it("stops dependency tracking with stop()", async () => {
      const s = signal(10);
      let calls = 0;

      const ac = asyncComputed(async () => {
        calls++;
        return s.value;
      });

      await vi.runAllTimersAsync();
      expect(calls).toBe(1);

      ac.stop();

      s.value = 20;
      await vi.runAllTimersAsync();
      expect(calls).toBe(1);

      expect(ac.value.value).toBe(10);
    });

    it("stop()で依存関係の追跡を停止する", async () => {
      const s = signal(10);
      let calls = 0;

      const ac = asyncComputed(async () => {
        calls++;
        return s.value;
      });

      await vi.runAllTimersAsync();
      expect(calls).toBe(1);

      ac.stop();

      s.value = 20;
      await vi.runAllTimersAsync();
      expect(calls).toBe(1);

      expect(ac.value.value).toBe(10);
    });
  });

  describe("synchronous errors", () => {
    it("catches synchronous errors in evaluator", async () => {
      const ac = asyncComputed(() => {
        throw new Error("Sync error");
      });

      await vi.runAllTimersAsync();

      expect(ac.loading.value).toBe(false);
      expect(ac.error.value).toBeInstanceOf(Error);
      expect((ac.error.value as Error).message).toBe("Sync error");

      ac.stop();
    });
  });

  describe("type guards", () => {
    it("correctly identifies AsyncComputed instances", () => {
      const ac = asyncComputed(async () => "test");
      const s = signal(10);

      expect(isAsyncComputed(ac)).toBe(true);
      expect(isAsyncComputed(s)).toBe(false);
      expect(isAsyncComputed({})).toBe(false);
      expect(isAsyncComputed(null)).toBe(false);
      expect(isAsyncComputed(undefined)).toBe(false);

      ac.stop();
    });
  });

  describe("Computed property reactivity", () => {
    it("value/loading/error properties work reactively", async () => {
      const ac = asyncComputed(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "result";
      });

      const states: Array<{ loading: boolean; value: any; error: any }> = [];

      const e = effect(() => {
        states.push({
          loading: ac.loading.value,
          value: ac.value.value,
          error: ac.error.value,
        });
      });

      await vi.runAllTimersAsync();

      expect(states).toEqual([
        { loading: true, value: undefined, error: null },
        { loading: false, value: "result", error: null },
      ]);

      e.stop();
      ac.stop();
    });
  });
});
