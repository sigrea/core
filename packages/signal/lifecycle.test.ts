import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../effect";
import { keepMount, onMount, onUnmount, signal } from "./index";

describe("Signal lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("onMount", () => {
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

    it("collects cleanup functions from mount callbacks", () => {
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
      vi.runAllTimers(); // Wait for unmount delay

      expect(cleaned).toBe(true);
    });

    it("warns about non-function cleanup return values", () => {
      const s = signal(1);
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // First subscriber to mount the signal
      const e = effect(() => {
        s.value;
      });

      // Now add mount callback after already mounted
      onMount(s, () => {
        // Return a non-function value
        return "not a function" as any;
      });

      expect(consoleWarn).toHaveBeenCalledWith(
        "Mount callback returned a non-function value:",
        "not a function",
      );

      e.stop();
    });

    it("validates arguments", () => {
      expect(() => onMount(null as any, () => {})).toThrow(
        "onMount can only be called on a Signal instance",
      );
      expect(() => onMount({} as any, () => {})).toThrow(
        "onMount can only be called on a Signal instance",
      );

      const s = signal(1);
      expect(() => onMount(s, null as any)).toThrow(
        "Mount callback must be a function",
      );
    });
  });

  describe("onUnmount", () => {
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
    });
  });

  describe("keepMount", () => {
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

      vi.runAllTimers();
      expect(unmounted).toBe(false); // Still kept alive

      // Release keep alive
      keepAlive();

      vi.runAllTimers();
      expect(unmounted).toBe(true);
    });

    it("validates arguments", () => {
      expect(() => keepMount(null as any)).toThrow(
        "keepMount can only be called on a Signal",
      );
      expect(() => keepMount({} as any)).toThrow(
        "keepMount can only be called on a Signal",
      );
    });
  });

  describe("listener count tracking", () => {
    it("tracks listener count correctly", () => {
      const s = signal(1);

      expect(s._listenerCount).toBe(0);
      expect(s._isMounted).toBe(false);

      const e1 = effect(() => {
        s.value;
      });

      expect(s._listenerCount).toBe(1);
      expect(s._isMounted).toBe(true);

      const e2 = effect(() => {
        s.value;
      });

      expect(s._listenerCount).toBe(2);

      e1.stop();
      expect(s._listenerCount).toBe(1);

      e2.stop();
      expect(s._listenerCount).toBe(0);
    });

    it("deduplicates subscribers using WeakSet", () => {
      const s = signal(1);

      expect(s._listenerCount).toBe(0);

      const e = effect(() => {
        // Access the signal multiple times in same effect
        s.value;
        s.value;
        s.value;
      });

      // Should only count as 1 subscriber despite multiple accesses
      expect(s._listenerCount).toBe(1);

      e.stop();
      expect(s._listenerCount).toBe(0);
    });

    it("handles multiple mount callbacks", () => {
      const s = signal(1);
      const mountCalls: number[] = [];

      onMount(s, () => {
        mountCalls.push(1);
      });

      onMount(s, () => {
        mountCalls.push(2);
      });

      const e = effect(() => {
        s.value;
      });

      expect(mountCalls).toEqual([1, 2]);

      e.stop();
    });
  });

  describe("error recovery", () => {
    it("continues executing other mount callbacks if one fails", () => {
      const s = signal(1);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      let callback2Executed = false;

      onMount(s, () => {
        throw new Error("Callback 1 error");
      });

      onMount(s, () => {
        callback2Executed = true;
      });

      const e = effect(() => {
        s.value;
      });

      expect(callback2Executed).toBe(true);

      e.stop();
    });

    it("continues executing cleanup functions if one fails", () => {
      const s = signal(1);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      let cleanup2Executed = false;

      onMount(s, () => {
        return () => {
          throw new Error("Cleanup 1 error");
        };
      });

      onMount(s, () => {
        return () => {
          cleanup2Executed = true;
        };
      });

      const e = effect(() => {
        s.value;
      });

      e.stop();
      vi.runAllTimers();

      expect(cleanup2Executed).toBe(true);
    });

    it("handles timer errors gracefully", () => {
      const s = signal(1);
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Mock setTimeout to throw
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (() => {
        throw new Error("Timer error");
      }) as any;

      let unmounted = false;
      onUnmount(s, () => {
        unmounted = true;
      });

      const e = effect(() => {
        s.value;
      });

      // Trigger unmount
      e.stop();

      // Should fall back to immediate unmount
      expect(unmounted).toBe(true);
      expect(consoleError).toHaveBeenCalledWith(
        "Timer scheduling error:",
        expect.any(Error),
      );

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe("integration scenarios", () => {
    it("handles data fetching with abort controller", async () => {
      const userId = signal(1);
      let fetchCount = 0;
      let abortCount = 0;

      onMount(userId, () => {
        const controller = new AbortController();
        fetchCount++;

        // Simulate fetch
        fetch(`/api/user/${userId.value}`, { signal: controller.signal }).catch(
          () => {},
        ); // Ignore errors in test

        return () => {
          abortCount++;
          controller.abort();
        };
      });

      const e = effect(() => {
        userId.value; // Subscribe
      });

      expect(fetchCount).toBe(1);

      e.stop();
      vi.runAllTimers();

      expect(abortCount).toBe(1);
    });

    it("handles timer-based updates", () => {
      const counter = signal(0);
      let intervalId: any;

      onMount(counter, () => {
        intervalId = setInterval(() => {
          counter.value++;
        }, 1000);

        return () => {
          clearInterval(intervalId);
        };
      });

      const values: number[] = [];
      const e = effect(() => {
        values.push(counter.value);
      });

      expect(values).toEqual([0]);

      vi.advanceTimersByTime(3000);
      expect(values).toEqual([0, 1, 2, 3]);

      e.stop();
      vi.runAllTimers();

      // Verify interval is cleared
      vi.advanceTimersByTime(2000);
      expect(values).toEqual([0, 1, 2, 3]); // No new values
    });
  });
});
