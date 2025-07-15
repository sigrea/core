import { beforeEach, describe, expect, it } from "vitest";
import { computed, effect, isSignal, signal } from "../..";

describe("Signal", () => {
  describe("value read/write", () => {
    it("holds initial value", () => {
      const s = signal(10);
      expect(s.value).toBe(10);
    });

    it("becomes undefined without initial value", () => {
      const s = signal();
      expect(s.value).toBe(undefined);
    });

    it("can update value", () => {
      const s = signal(10);
      s.value = 20;
      expect(s.value).toBe(20);
    });

    it("does not recompute dependents when updated with same value", () => {
      const s = signal(10);
      let computedCalls = 0;
      const c = computed(() => {
        computedCalls++;
        return s.value * 2;
      });

      expect(c.value).toBe(20);
      expect(computedCalls).toBe(1);

      s.value = 10;
      expect(c.value).toBe(20);
      expect(computedCalls).toBe(1);
    });
  });

  describe("reactivity", () => {
    it("updates dependent Computed", () => {
      const s = signal(10);
      const c = computed(() => s.value * 2);

      expect(c.value).toBe(20);

      s.value = 15;
      expect(c.value).toBe(30);
    });

    it("executes dependent Effect", () => {
      const s = signal(10);
      let effectValue = 0;
      const e = effect(() => {
        effectValue = s.value;
      });

      expect(effectValue).toBe(10);

      s.value = 20;
      expect(effectValue).toBe(20);

      e.stop();
    });

    it("supports multiple dependents", () => {
      const s = signal(10);
      const c1 = computed(() => s.value * 2);
      const c2 = computed(() => s.value + 5);

      expect(c1.value).toBe(20);
      expect(c2.value).toBe(15);

      s.value = 20;
      expect(c1.value).toBe(40);
      expect(c2.value).toBe(25);
    });
  });

  describe("type guards", () => {
    it("correctly identifies Signal instances", () => {
      const s = signal(10);
      const c = computed(() => 20);

      expect(isSignal(s)).toBe(true);
      expect(isSignal(c)).toBe(false);
      expect(isSignal({})).toBe(false);
      expect(isSignal(null)).toBe(false);
      expect(isSignal(undefined)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles null and undefined", () => {
      const s1 = signal<number | null>(null);
      const s2 = signal<string | undefined>(undefined);

      expect(s1.value).toBe(null);
      expect(s2.value).toBe(undefined);

      s1.value = 10;
      s2.value = "hello";

      expect(s1.value).toBe(10);
      expect(s2.value).toBe("hello");
    });

    it("detects changes by object reference comparison", () => {
      const obj = { count: 1 };
      const s = signal(obj);
      let effectCalls = 0;
      const e = effect(() => {
        effectCalls++;
        return s.value;
      });

      expect(effectCalls).toBe(1);

      obj.count = 2;
      s.value = obj;
      expect(effectCalls).toBe(1);

      s.value = { count: 2 };
      expect(effectCalls).toBe(2);

      e.stop();
    });
  });
});
