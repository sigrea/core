import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import { keepMount, onMount, onUnmount } from "../lifecycle";
import { signal } from "../signal";
import { computed } from "./index";

describe("Computed lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("onMount", () => {
    it("executes mount callback on first subscriber", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      let mounted = false;

      onMount(c, () => {
        mounted = true;
      });

      expect(mounted).toBe(false);

      const e = effect(() => {
        c.value; // Subscribe
      });

      expect(mounted).toBe(true);

      e.stop();
    });

    it("handles computed chains correctly", () => {
      const s = signal(1);
      const c1 = computed(() => s.value * 2);
      const c2 = computed(() => c1.value + 1);

      const mountOrder: string[] = [];

      onMount(c1, () => {
        mountOrder.push("c1");
      });

      onMount(c2, () => {
        mountOrder.push("c2");
      });

      const e = effect(() => {
        c2.value; // Subscribe to c2, which depends on c1
      });

      expect(mountOrder).toEqual(["c1", "c2"]);

      e.stop();
    });

    it("validates arguments", () => {
      expect(() => onMount(null as any, () => {})).toThrow(
        "onMount can only be called on a Signal or Computed instance",
      );
      expect(() => onMount({} as any, () => {})).toThrow(
        "onMount can only be called on a Signal or Computed instance",
      );

      const c = computed(() => 1);
      expect(() => onMount(c, null as any)).toThrow(
        "Mount callback must be a function",
      );
    });

    it("warns about non-function cleanup return values", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // First subscriber to mount the computed
      const e = effect(() => {
        c.value;
      });

      // Now add mount callback after already mounted
      onMount(c, () => {
        // Return a non-function value
        return { cleanup: "not a function" } as any;
      });

      expect(consoleWarn).toHaveBeenCalledWith(
        "Mount callback returned a non-function value:",
        { cleanup: "not a function" },
      );

      e.stop();
    });
  });

  describe("onUnmount", () => {
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

    it("handles nested computed unmounting correctly", () => {
      const s = signal(1);
      const c1 = computed(() => s.value * 2);
      const c2 = computed(() => c1.value + 1);

      const unmountOrder: string[] = [];

      onUnmount(c1, () => {
        unmountOrder.push("c1");
      });

      onUnmount(c2, () => {
        unmountOrder.push("c2");
      });

      const e = effect(() => {
        c2.value;
      });

      e.stop();
      vi.runAllTimers();

      // c2 unmounts first, then c1
      expect(unmountOrder).toEqual(["c2", "c1"]);
    });
  });

  describe("keepMount", () => {
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

      vi.runAllTimers();
      expect(unmounted).toBe(false); // Still kept alive

      // Release keep alive
      keepAlive();

      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });
  });

  describe("listener count tracking", () => {
    it("tracks listener count correctly for computed", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);

      expect(c._listenerCount).toBe(0);
      expect(c._isMounted).toBe(false);

      const e1 = effect(() => {
        c.value;
      });

      expect(c._listenerCount).toBe(1);
      expect(c._isMounted).toBe(true);

      const e2 = effect(() => {
        c.value;
      });

      expect(c._listenerCount).toBe(2);

      e1.stop();
      expect(c._listenerCount).toBe(1);

      e2.stop();
      expect(c._listenerCount).toBe(0);
    });

    it("deduplicates subscribers using WeakSet", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);

      expect(c._listenerCount).toBe(0);

      const e = effect(() => {
        // Access the computed multiple times in same effect
        c.value;
        c.value;
        c.value;
      });

      // Should only count as 1 subscriber despite multiple accesses
      expect(c._listenerCount).toBe(1);

      e.stop();
      expect(c._listenerCount).toBe(0);
    });

    it("handles dynamic dependencies correctly", () => {
      const useA = signal(true);
      const a = signal(10);
      const b = signal(20);

      let aMountCount = 0;
      let bMountCount = 0;
      let aUnmountCount = 0;
      let bUnmountCount = 0;

      onMount(a, () => {
        aMountCount++;
        return () => {
          aUnmountCount++;
        };
      });

      onMount(b, () => {
        bMountCount++;
        return () => {
          bUnmountCount++;
        };
      });

      const c = computed(() => (useA.value ? a.value : b.value));

      const e = effect(() => {
        c.value;
      });

      expect(aMountCount).toBe(1);
      expect(bMountCount).toBe(0);

      // Switch to b
      useA.value = false;

      expect(bMountCount).toBe(1);

      // Wait for a to unmount
      vi.runAllTimers();
      expect(aUnmountCount).toBe(1);

      e.stop();
    });
  });

  describe("error recovery", () => {
    it("handles errors in computed mount callbacks", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      let callback2Executed = false;

      onMount(c, () => {
        throw new Error("Mount error");
      });

      onMount(c, () => {
        callback2Executed = true;
      });

      const e = effect(() => {
        c.value;
      });

      expect(callback2Executed).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        "Mount callback error:",
        expect.any(Error),
      );

      e.stop();
    });
  });

  describe("integration scenarios", () => {
    it("handles computed with async dependencies", () => {
      const userId = signal(1);
      const userData = signal<{ name: string } | null>(null);

      const userName = computed(() => {
        // Actually use userId to trigger its mount
        const id = userId.value;
        return userData.value?.name || `Loading user ${id}...`;
      });

      let fetchCount = 0;

      onMount(userId, () => {
        fetchCount++;
        // Simulate async data fetch
        setTimeout(() => {
          userData.value = { name: `User ${userId.value}` };
        }, 100);
      });

      const values: string[] = [];
      const e = effect(() => {
        values.push(userName.value);
      });

      expect(values).toEqual(["Loading user 1..."]);
      expect(fetchCount).toBe(1);

      vi.advanceTimersByTime(100);
      expect(values).toEqual(["Loading user 1...", "User 1"]);

      e.stop();
    });

    it("handles complex computed dependency chains", () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);

      const sum = computed(() => a.value + b.value);
      const product = computed(() => sum.value * c.value);
      const final = computed(() => product.value + sum.value);

      const mountOrder: string[] = [];

      onMount(sum, () => {
        mountOrder.push("sum");
      });

      onMount(product, () => {
        mountOrder.push("product");
      });

      onMount(final, () => {
        mountOrder.push("final");
      });

      const e = effect(() => {
        final.value;
      });

      // Should mount in dependency order
      expect(mountOrder).toEqual(["sum", "product", "final"]);

      e.stop();
    });
  });
});
