import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "../../computed";
import { effect } from "../../effect";
import { signal } from "../../signal";
import { onMount } from "./index";

describe("onMount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("with Signal", () => {
    it("executes mount callback on first subscriber", () => {
      const s = signal(1);
      let mounted = false;

      onMount(s, () => {
        mounted = true;
      });

      expect(mounted).toBe(false);

      const e = effect(() => {
        s.value; // Subscribe
      });

      expect(mounted).toBe(true);

      e.stop();
    });

    it("executes mount callback immediately if already mounted", () => {
      const s = signal(1);
      let mountCount = 0;

      // First subscriber
      const e1 = effect(() => {
        s.value;
      });

      // Add mount callback after already mounted
      onMount(s, () => {
        mountCount++;
      });

      expect(mountCount).toBe(1); // Executed immediately

      // Second subscriber doesn't trigger mount again
      const e2 = effect(() => {
        s.value;
      });

      expect(mountCount).toBe(1);

      e1.stop();
      e2.stop();
    });

    it("returns unsubscribe function", () => {
      const s = signal(1);
      let mounted = false;

      const unsubscribe = onMount(s, () => {
        mounted = true;
      });

      unsubscribe();

      const e = effect(() => {
        s.value;
      });

      expect(mounted).toBe(false); // Callback was unsubscribed

      e.stop();
    });

    it("handles mount callback errors", () => {
      const s = signal(1);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      onMount(s, () => {
        throw new Error("Mount error");
      });

      const e = effect(() => {
        s.value;
      });

      expect(consoleError).toHaveBeenCalledWith(
        "Mount callback error:",
        expect.any(Error),
      );

      e.stop();
    });

    it("executes cleanup function on unmount", () => {
      const s = signal(1);
      let cleaned = false;

      onMount(s, () => {
        return () => {
          cleaned = true;
        };
      });

      const e = effect(() => {
        s.value;
      });

      expect(cleaned).toBe(false);

      e.stop();
      vi.runAllTimers();

      expect(cleaned).toBe(true);
    });
  });

  describe("with Computed", () => {
    it("executes mount callback on first subscriber", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      let mounted = false;

      onMount(c, () => {
        mounted = true;
      });

      expect(mounted).toBe(false);

      // Create an effect that depends on the computed
      const e = effect(() => {
        c.value; // Subscribe to computed
      });

      expect(mounted).toBe(true);

      e.stop();
    });

    it("handles nested computed dependencies", () => {
      const s = signal(1);
      const c1 = computed(() => s.value * 2);
      const c2 = computed(() => c1.value + 1);
      let mounted = false;

      onMount(c1, () => {
        mounted = true;
      });

      // Create an effect that depends on c2, which depends on c1
      const e = effect(() => {
        c2.value; // This will also subscribe to c1
      });

      expect(mounted).toBe(true);

      e.stop();
    });
  });

  describe("error handling", () => {
    it("throws for non-Signal/Computed inputs", () => {
      expect(() => onMount(null as any, () => {})).toThrow(
        "onMount can only be called on a Signal or Computed instance",
      );
      expect(() => onMount({} as any, () => {})).toThrow(
        "onMount can only be called on a Signal or Computed instance",
      );
    });
  });
});
