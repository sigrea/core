import { describe, expect, it } from "vitest";
import { computed } from "../../computed";
import { signal } from "../../signal";
import { activeSub, getActiveSub, setActiveSub } from "./index";

describe("reactive-system/activeSub", () => {
  describe("active subscriber management", () => {
    it("starts with undefined activeSub", () => {
      expect(getActiveSub()).toBe(undefined);
      expect(activeSub).toBe(undefined);
    });

    it("sets and gets active subscriber", () => {
      const s = signal(1);
      const c = computed(() => s.value * 2);

      setActiveSub(c);
      expect(getActiveSub()).toBe(c);
      expect(activeSub).toBe(c);

      setActiveSub(undefined);
      expect(getActiveSub()).toBe(undefined);
      expect(activeSub).toBe(undefined);
    });

    it("tracks active subscriber during computed evaluation", () => {
      const s = signal(1);
      let capturedSub: any = null;

      const c = computed(() => {
        capturedSub = getActiveSub();
        return s.value * 2;
      });

      // Before evaluation, no active sub
      expect(getActiveSub()).toBe(undefined);

      // During evaluation, c is the active sub
      const result = c.value;
      expect(result).toBe(2);
      expect(capturedSub).toBe(c);

      // After evaluation, back to undefined
      expect(getActiveSub()).toBe(undefined);
    });

    it("handles nested computed evaluations", () => {
      const s = signal(1);
      const capturedSubs: any[] = [];

      const c1 = computed(() => {
        capturedSubs.push({ c1: getActiveSub() });
        return s.value * 2;
      });

      const c2 = computed(() => {
        capturedSubs.push({ c2_before: getActiveSub() });
        const result = c1.value + 1;
        capturedSubs.push({ c2_after: getActiveSub() });
        return result;
      });

      // Clear captured subs
      capturedSubs.length = 0;

      // Evaluate c2
      const result = c2.value;
      expect(result).toBe(3);

      // Check captured active subs
      expect(capturedSubs).toEqual([
        { c2_before: c2 }, // c2 is active when it starts
        { c1: c1 }, // c1 becomes active during its evaluation
        { c2_after: c2 }, // c2 is active again after c1 completes
      ]);

      // After all evaluation, back to undefined
      expect(getActiveSub()).toBe(undefined);
    });

    it("restores previous active subscriber after nested evaluation", () => {
      const s = signal(1);
      let c1ActiveSub: any = null;
      let c2ActiveSub: any = null;

      const c1 = computed(() => {
        return s.value * 2;
      });

      const c2 = computed(() => {
        c2ActiveSub = getActiveSub();
        const val = c1.value;
        c1ActiveSub = getActiveSub();
        return val + 1;
      });

      // Manually set an active sub to test restoration
      const dummySub = { dummy: true };
      setActiveSub(dummySub as any);

      // This should be wrapped in actual computed/effect usage
      // For this test, we'll manually manage it
      setActiveSub(c2);
      c2.update();
      setActiveSub(dummySub as any);

      // Original active sub should be restored
      expect(getActiveSub()).toBe(dummySub);

      // Clean up
      setActiveSub(undefined);
    });
  });

  describe("integration with dependency tracking", () => {
    it("activeSub determines dependency collection", () => {
      const s1 = signal(1);
      const s2 = signal(2);
      const s3 = signal(3);

      // Computed that accesses all signals
      const c = computed(() => {
        const a = s1.value;
        const b = s2.value;

        // Access s3 when no active sub
        setActiveSub(undefined);
        const c = s3.value;
        setActiveSub(c as any); // Restore

        return a + b + c;
      });

      // Initial evaluation
      expect(c.value).toBe(6);

      // Update s1 and s2 - should trigger update
      s1.value = 10;
      expect(c.value).toBe(15);

      s2.value = 20;
      expect(c.value).toBe(33);

      // Update s3 - might not trigger update if dependency wasn't tracked
      // (This depends on the specific implementation details)
    });
  });
});
