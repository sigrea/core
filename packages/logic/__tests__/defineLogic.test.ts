import { afterEach, describe, expect, it, vi } from "vitest";

import { computed } from "../../core/computed";
import { signal } from "../../core/signal";
import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { defineLogic } from "../defineLogic";
import { cleanupLogic, cleanupLogics, mountLogic } from "../testing";

afterEach(() => {
	cleanupLogics();
});

describe("defineLogic", () => {
	it("creates reusable logic instances with reactive state", () => {
		const CounterLogic = defineLogic()(() => {
			const count = signal(0);
			const doubled = computed(() => count.value * 2);
			const increment = () => {
				count.value += 1;
			};

			return { count, doubled, increment };
		});

		const counter = mountLogic(CounterLogic);

		expect(counter.count.value).toBe(0);
		expect(counter.doubled.value).toBe(0);

		counter.increment();
		expect(counter.count.value).toBe(1);
		expect(counter.doubled.value).toBe(2);
	});

	it("passes props to the setup function", () => {
		const Logic = defineLogic<{ initialCount: number }>()((props) => {
			const count = signal(props.initialCount);
			return { count };
		});

		const instance = mountLogic(Logic, { initialCount: 3 });

		expect(instance.count.value).toBe(3);
	});

	it("runs onUnmount cleanups when logic is disposed", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onMount(() => {
				return () => {
					cleanup();
				};
			});

			return {};
		});

		const instance = mountLogic(Logic);

		expect(cleanup).not.toHaveBeenCalled();

		cleanupLogic(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes child logic when the parent is cleaned up", () => {
		const childCleanup = vi.fn();

		const ChildLogic = defineLogic()(() => {
			onUnmount(() => {
				childCleanup();
			});
			return {};
		});

		const ParentLogic = defineLogic()((_, { get }) => {
			get(ChildLogic);
			return {};
		});

		const parent = mountLogic(ParentLogic);

		cleanupLogic(parent);

		expect(childCleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes scope when setup throws", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onMount(() => {
				return () => {
					cleanup();
				};
			});

			throw new Error("boom");
		});

		expect(() => mountLogic(Logic)).toThrow("boom");
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("cleanupLogics tears down every tracked instance", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		mountLogic(Logic);
		mountLogic(Logic);

		cleanupLogics();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it("passes props to child logic instances via get", () => {
		const ChildLogic = defineLogic<{ id: number }>()((props) => {
			const identifier = signal(props.id);
			return { identifier };
		});

		const ParentLogic = defineLogic<{ childId: number }>()((props, { get }) => {
			const child = get(ChildLogic, { id: props.childId });
			return { child };
		});

		const parent = mountLogic(ParentLogic, { childId: 42 });
		expect(parent.child.identifier.value).toBe(42);
	});
});
