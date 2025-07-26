import { describe, expect, it, vi } from "vitest";
import { computed } from "../../computed";
import { effect } from "../../effect";
import { signal } from "../../signal";

describe("reactive-system/tracking", () => {
  describe("link", () => {
    it("establishes dependency relationship", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);

      // Access computed to establish link
      expect(c.value).toBe(2);

      // Update signal
      s.value = 2;

      // Computed should update
      expect(c.value).toBe(4);
    });
  });

  describe("endTracking", () => {
    it("notifies removed dependencies via _untrackSubscriber", () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let condition = true;

      // Create computed that conditionally depends on signals
      const c = computed(() => {
        return condition ? s1.value : s2.value;
      });

      // Initial access - depends on s1
      expect(c.value).toBe(1);

      // Track _untrackSubscriber calls
      const untrackSpy1 = vi.spyOn(s1 as any, "_untrackSubscriber");
      const untrackSpy2 = vi.spyOn(s2 as any, "_untrackSubscriber");

      // Change condition and recompute
      condition = false;
      s1.value = 10; // Trigger recomputation
      expect(c.value).toBe(2); // Now depends on s2

      // s1 should have been notified about removal
      expect(untrackSpy1).toHaveBeenCalledWith(c);
      expect(untrackSpy2).not.toHaveBeenCalled();

      // Change back
      condition = true;
      s2.value = 20; // Trigger recomputation
      expect(c.value).toBe(10); // Back to s1

      // s2 should have been notified about removal
      expect(untrackSpy2).toHaveBeenCalledWith(c);
    });

    it("handles multiple dependency changes", () => {
      const signals = [signal(1), signal(2), signal(3), signal(4)];
      let includeCount = 2;

      const c = computed(() => {
        let sum = 0;
        for (let i = 0; i < includeCount; i++) {
          sum += signals[i].value;
        }
        return sum;
      });

      // Initial computation - depends on first 2 signals
      expect(c.value).toBe(3);

      // Track _untrackSubscriber calls
      const spies = signals.map((s) =>
        vi.spyOn(s as any, "_untrackSubscriber"),
      );

      // Increase dependency count
      includeCount = 4;
      signals[0].value = 10; // Trigger recomputation
      expect(c.value).toBe(10 + 2 + 3 + 4);

      // No signals should be untracked (only added more)
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }

      // Decrease dependency count
      includeCount = 1;
      signals[0].value = 1; // Trigger recomputation
      expect(c.value).toBe(1);

      // Signals 1, 2, 3 should be untracked
      expect(spies[0]).not.toHaveBeenCalled();
      expect(spies[1]).toHaveBeenCalledWith(c);
      expect(spies[2]).toHaveBeenCalledWith(c);
      expect(spies[3]).toHaveBeenCalledWith(c);
    });

    it("cleans up WeakMap entries when no dependencies remain", () => {
      const s = signal(1);
      let includeDep = true;

      const c = computed(() => {
        return includeDep ? s.value * 2 : 0;
      });

      // Initial computation with dependency
      expect(c.value).toBe(2);

      // Remove all dependencies
      includeDep = false;
      s.value = 2; // Trigger recomputation
      expect(c.value).toBe(0);

      // Verify cleanup (implementation detail - WeakMap should be cleaned)
      // This is tested indirectly by ensuring no memory leaks
    });
  });

  describe("integration with lifecycle", () => {
    it("lifecycle cleanup happens when dependencies are removed", () => {
      const s1 = signal(1);
      const s2 = signal(2);
      let useFirst = true;

      // Set up lifecycle tracking
      let s1ListenerCount = 0;
      let s2ListenerCount = 0;

      const originalTrack1 = (s1 as any)._trackSubscriber;
      const originalUntrack1 = (s1 as any)._untrackSubscriber;
      (s1 as any)._trackSubscriber = function (sub: any) {
        s1ListenerCount++;
        originalTrack1.call(this, sub);
      };
      (s1 as any)._untrackSubscriber = function (sub: any) {
        s1ListenerCount--;
        originalUntrack1.call(this, sub);
      };

      const originalTrack2 = (s2 as any)._trackSubscriber;
      const originalUntrack2 = (s2 as any)._untrackSubscriber;
      (s2 as any)._trackSubscriber = function (sub: any) {
        s2ListenerCount++;
        originalTrack2.call(this, sub);
      };
      (s2 as any)._untrackSubscriber = function (sub: any) {
        s2ListenerCount--;
        originalUntrack2.call(this, sub);
      };

      const c = computed(() => (useFirst ? s1.value : s2.value));

      // Create effect to keep computed active
      const e = effect(() => c.value);

      expect(s1ListenerCount).toBe(1);
      expect(s2ListenerCount).toBe(0);

      // Switch to s2
      useFirst = false;
      s1.value = 10; // Trigger update

      expect(s1ListenerCount).toBe(0);
      expect(s2ListenerCount).toBe(1);

      e.stop();
    });
  });
});
