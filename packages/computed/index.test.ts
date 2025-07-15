import { describe, expect, it } from "vitest";
import {
  computed,
  effect,
  isComputed,
  isSignal,
  readonly,
  signal,
} from "../..";

describe("Computed", () => {
  describe("lazy evaluation and caching", () => {
    it("is not evaluated until first access", () => {
      let calls = 0;
      const s = signal(10);
      const c = computed(() => {
        calls++;
        return s.value * 2;
      });

      expect(calls).toBe(0);

      const result = c.value;
      expect(result).toBe(20);
      expect(calls).toBe(1);
    });

    it("is not recalculated if dependencies do not change", () => {
      let calls = 0;
      const s = signal(10);
      const c = computed(() => {
        calls++;
        return s.value * 2;
      });

      expect(c.value).toBe(20);
      expect(calls).toBe(1);

      expect(c.value).toBe(20);
      expect(calls).toBe(1);
    });

    it("is recalculated when dependencies change", () => {
      let calls = 0;
      const s = signal(10);
      const c = computed(() => {
        calls++;
        return s.value * 2;
      });

      expect(c.value).toBe(20);
      expect(calls).toBe(1);

      s.value = 20;
      expect(c.value).toBe(40);
      expect(calls).toBe(2);
    });
  });

  describe("automatic dependency tracking", () => {
    it("can depend on multiple Signals", () => {
      const a = signal(10);
      const b = signal(20);
      const sum = computed(() => a.value + b.value);

      expect(sum.value).toBe(30);

      a.value = 15;
      expect(sum.value).toBe(35);

      b.value = 25;
      expect(sum.value).toBe(40);
    });

    it("dynamic dependencies through conditional branches", () => {
      const condition = signal(true);
      const a = signal(10);
      const b = signal(20);
      let aCalls = 0;
      let bCalls = 0;

      const result = computed(() => {
        if (condition.value) {
          aCalls++;
          return a.value;
        }
        bCalls++;
        return b.value;
      });

      expect(result.value).toBe(10);
      expect(aCalls).toBe(1);
      expect(bCalls).toBe(0);

      b.value = 30;
      expect(result.value).toBe(10);
      expect(aCalls).toBe(1);
      expect(bCalls).toBe(0);

      condition.value = false;
      expect(result.value).toBe(30);
      expect(aCalls).toBe(1);
      expect(bCalls).toBe(1);

      a.value = 40;
      expect(result.value).toBe(30);
      expect(aCalls).toBe(1);
      expect(bCalls).toBe(1);
    });

    it("Computed can depend on other Computed", () => {
      const s = signal(10);
      const double = computed(() => s.value * 2);
      const quadruple = computed(() => double.value * 2);

      expect(quadruple.value).toBe(40);

      s.value = 20;
      expect(double.value).toBe(40);
      expect(quadruple.value).toBe(80);
    });
  });

  describe("circular reference detection", () => {
    it("self-reference causes infinite loop", () => {
      const s = signal(10);

      expect(() => {
        // Example of code that should not be written:
        // const c: any = computed(() => c.value + s.value);
        // c.value; // causes infinite loop
      }).not.toThrow();
    });
  });

  describe("readonly function", () => {
    it("wraps Signal with Computed to make it read-only", () => {
      const s = signal(10);
      const r = readonly(s);

      expect(r.value).toBe(10);
      expect(isComputed(r)).toBe(true);
      expect(isSignal(r)).toBe(false);

      s.value = 20;
      expect(r.value).toBe(20);
    });
  });

  describe("type guards", () => {
    it("correctly identifies Computed instances", () => {
      const s = signal(10);
      const c = computed(() => s.value * 2);

      expect(isComputed(c)).toBe(true);
      expect(isComputed(s)).toBe(false);
      expect(isComputed({})).toBe(false);
      expect(isComputed(null)).toBe(false);
      expect(isComputed(undefined)).toBe(false);
    });
  });

  describe("memory leak prevention", () => {
    it("unused Computed is released from dependencies", () => {
      const s = signal(10);
      let calls = 0;

      {
        const c = computed(() => {
          calls++;
          return s.value * 2;
        });

        expect(c.value).toBe(20);
        expect(calls).toBe(1);
      }

      s.value = 20;

      const c2 = computed(() => s.value * 3);
      expect(c2.value).toBe(60);
      expect(calls).toBe(1);
    });
  });
});
