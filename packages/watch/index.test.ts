import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asyncComputed, computed, signal, watch } from "../..";

describe("Watch", () => {
  describe("basic watching", () => {
    it("watches Signal changes and receives old and new values", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback);

      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(20, 10);

      s.value = 30;
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(30, 20);

      w.stop();
    });

    it("can watch Computed changes", () => {
      const s = signal(10);
      const c = computed(() => s.value * 2);
      const callback = vi.fn();

      const w = watch(c, callback);

      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(40, 20);

      w.stop();
    });

    it("can watch function return value", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(() => s.value + 5, callback);

      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(25, 15);

      w.stop();
    });
  });

  describe("immediate option", () => {
    it("executes initially with immediate: true", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback, { immediate: true });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(10, undefined);

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(20, 10);

      w.stop();
    });

    it("does not execute initially with immediate: false (default)", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback, { immediate: false });

      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(20, 10);

      w.stop();
    });
  });

  describe("value comparison", () => {
    it("does not execute callback when updated with same value", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback);

      s.value = 10;
      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);

      s.value = 20;
      expect(callback).toHaveBeenCalledTimes(1);

      w.stop();
    });

    it("objects are compared by reference", () => {
      const obj1 = { count: 1 };
      const obj2 = { count: 1 };
      const s = signal(obj1);
      const callback = vi.fn();

      const w = watch(s, callback);

      obj1.count = 2;
      s.value = obj1;
      expect(callback).not.toHaveBeenCalled();

      s.value = obj2;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(obj2, obj1);

      w.stop();
    });
  });

  describe("cleanup", () => {
    it("callback is not executed after stop()", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback);
      w.stop();

      s.value = 20;
      expect(callback).not.toHaveBeenCalled();
    });

    it("can manually run() after stop()", () => {
      const s = signal(10);
      const callback = vi.fn();

      const w = watch(s, callback);
      w.stop();

      s.value = 20;
      expect(callback).not.toHaveBeenCalled();

      w.run();
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(20, 10);
    });
  });

  describe("complex watching patterns", () => {
    it("can watch functions with multiple dependencies", () => {
      const a = signal(10);
      const b = signal(20);
      const callback = vi.fn();

      const w = watch(() => a.value + b.value, callback);

      a.value = 15;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(35, 30);

      b.value = 25;
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(40, 35);

      w.stop();
    });

    it("can watch functions with conditional branches", () => {
      const condition = signal(true);
      const a = signal(10);
      const b = signal(20);
      const callback = vi.fn();

      const w = watch(() => (condition.value ? a.value : b.value), callback);

      a.value = 15;
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(15, 10);

      b.value = 25;
      expect(callback).toHaveBeenCalledTimes(1);

      condition.value = false;
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith(25, 15);

      a.value = 30;
      expect(callback).toHaveBeenCalledTimes(2);

      w.stop();
    });
  });

  describe("AsyncComputed watching", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("can watch AsyncComputed value", async () => {
      const s = signal(10);
      const ac = asyncComputed(async () => {
        return s.value * 2;
      });
      const callback = vi.fn();

      const w = watch(ac, callback);

      await vi.runAllTimersAsync();

      expect(callback).not.toHaveBeenCalled();

      s.value = 20;
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(40, 20);

      w.stop();
      ac.stop();
    });

    it("can watch AsyncComputed loading state", async () => {
      let resolvePromise: (value: string) => void;
      const ac = asyncComputed(async () => {
        return new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });
      });
      const callback = vi.fn();

      const w = watch(() => ac.loading.value, callback);

      expect(callback).not.toHaveBeenCalled();
      expect(ac.loading.value).toBe(true);

      resolvePromise?.("done");
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(false, true);

      w.stop();
      ac.stop();
    });

    it("can watch AsyncComputed error state", async () => {
      let shouldError = false;
      const ac = asyncComputed(async () => {
        if (shouldError) {
          throw new Error("Test error");
        }
        return "success";
      });
      const callback = vi.fn();

      const w = watch(() => ac.error.value, callback);

      await vi.runAllTimersAsync();
      expect(callback).not.toHaveBeenCalled();

      shouldError = true;
      ac.refresh();
      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Test error" }),
        null,
      );

      w.stop();
      ac.stop();
    });

    it("watches AsyncComputed with immediate: true", async () => {
      const ac = asyncComputed(
        async () => {
          return "hello";
        },
        { initialValue: "initial" },
      );
      const callback = vi.fn();

      const w = watch(ac, callback, { immediate: true });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith("initial", undefined);

      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledWith("hello", "initial");

      w.stop();
      ac.stop();
    });
  });
});
