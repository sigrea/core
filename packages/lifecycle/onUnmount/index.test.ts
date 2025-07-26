import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "../../computed";
import { effect } from "../../effect";
import { signal } from "../../signal";
import { onUnmount } from "./index";

describe("onUnmount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("with Signal", () => {
    it("executes unmount callback when last subscriber is removed", () => {
      const s = signal(1);
      let unmounted = false;

      onUnmount(s, () => {
        unmounted = true;
      });

      const e = effect(() => {
        s.value;
      });

      expect(unmounted).toBe(false);

      e.stop();
      expect(unmounted).toBe(false); // Not yet, has 1 second delay

      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("cancels unmount if new subscriber added during delay", () => {
      const s = signal(1);
      let unmounted = false;

      onUnmount(s, () => {
        unmounted = true;
      });

      const e1 = effect(() => {
        s.value;
      });

      e1.stop();

      // Add new subscriber before timer expires
      vi.advanceTimersByTime(500);
      const e2 = effect(() => {
        s.value;
      });

      vi.runAllTimers();
      expect(unmounted).toBe(false);

      e2.stop();
      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("handles multiple unmount callbacks", () => {
      const s = signal(1);
      let unmount1 = false;
      let unmount2 = false;

      onUnmount(s, () => {
        unmount1 = true;
      });

      onUnmount(s, () => {
        unmount2 = true;
      });

      const e = effect(() => {
        s.value;
      });

      e.stop();
      vi.runAllTimers();

      expect(unmount1).toBe(true);
      expect(unmount2).toBe(true);
    });

    it("returns unsubscribe function", () => {
      const s = signal(1);
      let unmounted = false;

      const unsubscribe = onUnmount(s, () => {
        unmounted = true;
      });

      unsubscribe();

      const e = effect(() => {
        s.value;
      });

      e.stop();
      vi.runAllTimers();

      expect(unmounted).toBe(false);
    });
  });

  describe("with Computed", () => {
    it("executes unmount callback when last subscriber is removed", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      let unmounted = false;

      onUnmount(c, () => {
        unmounted = true;
      });

      const e = effect(() => {
        c.value;
      });

      expect(unmounted).toBe(false);

      e.stop();
      expect(unmounted).toBe(false); // Not yet, has 1 second delay

      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("handles nested computed unmounting", () => {
      const s = signal(1);
      const c1 = computed(() => s.value * 2);
      const c2 = computed(() => c1.value + 1);
      let unmounted1 = false;
      let unmounted2 = false;

      onUnmount(c1, () => {
        unmounted1 = true;
      });

      onUnmount(c2, () => {
        unmounted2 = true;
      });

      const e = effect(() => {
        c2.value;
      });

      e.stop();
      vi.runAllTimers();

      expect(unmounted1).toBe(true);
      expect(unmounted2).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws for non-Signal/Computed inputs", () => {
      expect(() => onUnmount(null as any, () => {})).toThrow(
        "onUnmount can only be called on a Signal or Computed instance",
      );
      expect(() => onUnmount({} as any, () => {})).toThrow(
        "onUnmount can only be called on a Signal or Computed instance",
      );
    });

    it("handles unmount callback errors", () => {
      const s = signal(1);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      onUnmount(s, () => {
        throw new Error("Unmount error");
      });

      const e = effect(() => {
        s.value;
      });

      e.stop();
      vi.runAllTimers();

      expect(consoleError).toHaveBeenCalledWith(
        "Cleanup function error:",
        expect.any(Error),
      );
    });
  });
});
