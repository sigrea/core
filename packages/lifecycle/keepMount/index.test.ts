import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computed } from "../../computed";
import { effect } from "../../effect";
import { signal } from "../../signal";
import { onUnmount } from "../onUnmount";
import { keepMount } from "./index";

describe("keepMount", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("with Signal", () => {
    it("prevents unmount while keep alive is active", () => {
      const s = signal(1);
      let unmounted = false;

      onUnmount(s, () => {
        unmounted = true;
      });

      const keepAlive = keepMount(s);

      // Add and remove a regular subscriber
      const e = effect(() => {
        s.value;
      });
      e.stop();

      // Unmount timer should not trigger while keepAlive is active
      vi.runAllTimers();
      expect(unmounted).toBe(false);

      // Release keep alive
      keepAlive();

      // Now unmount should happen
      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("maintains mount state during temporary disconnections", () => {
      const s = signal(1);
      let mountCount = 0;
      let unmountCount = 0;

      const unsubscribeMount = s.onMount(() => {
        mountCount++;
        return () => {
          unmountCount++;
        };
      });

      // Initial mount
      const e1 = effect(() => {
        s.value;
      });
      expect(mountCount).toBe(1);

      // Keep alive
      const keepAlive = keepMount(s);

      // Remove original subscriber
      e1.stop();
      vi.runAllTimers();

      // Should still be mounted
      expect(unmountCount).toBe(0);
      expect(mountCount).toBe(1);

      // Add new subscriber - should not trigger mount again
      const e2 = effect(() => {
        s.value;
      });
      expect(mountCount).toBe(1);

      // Clean up
      e2.stop();
      keepAlive();
      vi.runAllTimers();
      expect(unmountCount).toBe(1);

      unsubscribeMount();
    });

    it("allows multiple keepMount calls", () => {
      const s = signal(1);
      let unmounted = false;

      onUnmount(s, () => {
        unmounted = true;
      });

      const keepAlive1 = keepMount(s);
      const keepAlive2 = keepMount(s);

      // Release first keep alive
      keepAlive1();
      vi.runAllTimers();
      expect(unmounted).toBe(false); // Still kept alive by keepAlive2

      // Release second keep alive
      keepAlive2();
      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });
  });

  describe("with Computed", () => {
    it("prevents unmount while keep alive is active", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      let unmounted = false;

      onUnmount(c, () => {
        unmounted = true;
      });

      const keepAlive = keepMount(c);

      // Add and remove a regular subscriber
      const e = effect(() => {
        c.value;
      });
      e.stop();

      // Unmount timer should not trigger while keepAlive is active
      vi.runAllTimers();
      expect(unmounted).toBe(false);

      // Release keep alive
      keepAlive();

      // Now unmount should happen
      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("handles nested computed keep alive", () => {
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

      // Keep both alive
      const keepAlive1 = keepMount(c1);
      const keepAlive2 = keepMount(c2);

      // Access c2 which will also access c1
      const e = effect(() => {
        c2.value;
      });

      e.stop();
      vi.runAllTimers();

      // Both should still be mounted
      expect(unmounted1).toBe(false);
      expect(unmounted2).toBe(false);

      // Release keep alives
      keepAlive1();
      keepAlive2();
      vi.runAllTimers();

      // Now both should be unmounted
      expect(unmounted1).toBe(true);
      expect(unmounted2).toBe(true);
    });
  });

  describe("error handling", () => {
    it("throws for non-Signal/Computed inputs", () => {
      expect(() => keepMount(null as any)).toThrow(
        "keepMount can only be called on a Signal or Computed instance",
      );
      expect(() => keepMount({} as any)).toThrow(
        "keepMount can only be called on a Signal or Computed instance",
      );
    });
  });
});
