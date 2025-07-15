import { describe, expect, it } from "vitest";
import { computed, effect, signal } from "../..";

describe("Effect", () => {
  describe("automatic execution", () => {
    it("executes immediately upon creation", () => {
      let executed = false;
      const e = effect(() => {
        executed = true;
      });

      expect(executed).toBe(true);
      e.stop();
    });

    it("re-executes when dependent Signal changes", () => {
      const s = signal(10);
      let executions = 0;
      let lastValue = 0;

      const e = effect(() => {
        executions++;
        lastValue = s.value;
      });

      expect(executions).toBe(1);
      expect(lastValue).toBe(10);

      s.value = 20;
      expect(executions).toBe(2);
      expect(lastValue).toBe(20);

      s.value = 30;
      expect(executions).toBe(3);
      expect(lastValue).toBe(30);

      e.stop();
    });

    it("re-executes when dependent Computed changes", () => {
      const s = signal(10);
      const c = computed(() => s.value * 2);
      let executions = 0;
      let lastValue = 0;

      const e = effect(() => {
        executions++;
        lastValue = c.value;
      });

      expect(executions).toBe(1);
      expect(lastValue).toBe(20);

      s.value = 20;
      expect(executions).toBe(2);
      expect(lastValue).toBe(40);

      e.stop();
    });
  });

  describe("dynamic dependencies", () => {
    it("correctly tracks dynamic dependencies through conditional branches", () => {
      const condition = signal(true);
      const a = signal(10);
      const b = signal(20);
      let executions = 0;
      let lastValue = 0;

      const e = effect(() => {
        executions++;
        lastValue = condition.value ? a.value : b.value;
      });

      expect(executions).toBe(1);
      expect(lastValue).toBe(10);

      b.value = 30;
      expect(executions).toBe(1);

      condition.value = false;
      expect(executions).toBe(2);
      expect(lastValue).toBe(30);

      a.value = 40;
      expect(executions).toBe(2);

      b.value = 50;
      expect(executions).toBe(3);
      expect(lastValue).toBe(50);

      e.stop();
    });
  });

  describe("cleanup", () => {
    it("does not re-execute after stop()", () => {
      const s = signal(10);
      let executions = 0;

      const e = effect(() => {
        executions++;
        s.value;
      });

      expect(executions).toBe(1);

      e.stop();

      s.value = 20;
      expect(executions).toBe(1);
    });

    it("can manually run() after stop()", () => {
      const s = signal(10);
      let executions = 0;
      let lastValue = 0;

      const e = effect(() => {
        executions++;
        lastValue = s.value;
      });

      expect(executions).toBe(1);
      expect(lastValue).toBe(10);

      e.stop();
      s.value = 20;
      expect(executions).toBe(1);

      e.run();
      expect(executions).toBe(2);
      expect(lastValue).toBe(20);
    });
  });

  describe("error handling", () => {
    it("maintains dependencies even when error occurs in Effect", () => {
      const s = signal(10);
      let executions = 0;

      const e = effect(() => {
        executions++;
        if (s.value === 20) {
          throw new Error("Test error");
        }
        s.value;
      });

      expect(executions).toBe(1);

      expect(() => {
        s.value = 20;
      }).toThrow("Test error");
      expect(executions).toBe(2);

      s.value = 30;
      expect(executions).toBe(3);

      e.stop();
    });
  });

  describe("nested Effects", () => {
    it("can create Effect inside Effect", () => {
      const trigger = signal(0);
      const s = signal(10);
      let outerExecutions = 0;
      let innerExecutions = 0;
      let innerEffects: any[] = [];

      const outerEffect = effect(() => {
        outerExecutions++;
        trigger.value;

        for (const e of innerEffects) {
          e.stop();
        }
        innerEffects = [];

        const newEffect = effect(() => {
          innerExecutions++;
          s.value;
        });
        innerEffects.push(newEffect);
      });

      expect(outerExecutions).toBe(1);
      expect(innerExecutions).toBe(1);

      s.value = 20;
      expect(outerExecutions).toBe(1);
      expect(innerExecutions).toBe(2);

      trigger.value = 1;
      expect(outerExecutions).toBe(2);
      expect(innerExecutions).toBe(3);

      outerEffect.stop();
      for (const e of innerEffects) {
        e.stop();
      }
    });
  });

  describe("return values", () => {
    it("preserves Effect function return value", () => {
      const s = signal(10);
      const e = effect(() => {
        return s.value * 2;
      });

      const result = e.run();
      expect(result).toBe(20);

      s.value = 20;
      const result2 = e.run();
      expect(result2).toBe(40);

      e.stop();
    });
  });
});
