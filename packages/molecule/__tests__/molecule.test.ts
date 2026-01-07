import { afterEach, describe, expect, it, vi } from "vitest";

import { computed } from "../../core/computed";
import { onDispose } from "../../core/scope";
import { signal } from "../../core/signal";
import { onMount } from "../../lifecycle/onMount";
import { disposeMolecule, mountMolecule, unmountMolecule } from "../internals";
import { molecule } from "../molecule";
import { disposeTrackedMolecules, trackMolecule } from "../testing";
import { use } from "../use";

afterEach(() => {
	disposeTrackedMolecules();
});

describe("molecule", () => {
	it("creates reusable molecule instances with reactive state", () => {
		const CounterMolecule = molecule(() => {
			const count = signal(0);
			const doubled = computed(() => count.value * 2);
			const increment = () => {
				count.value += 1;
			};

			return { count, doubled, increment };
		});

		const counter = CounterMolecule();
		trackMolecule(counter);

		expect(counter.count.value).toBe(0);
		expect(counter.doubled.value).toBe(0);

		counter.increment();
		expect(counter.count.value).toBe(1);
		expect(counter.doubled.value).toBe(2);
	});

	it("passes props to the setup function", () => {
		const CounterMolecule = molecule((props: { initialCount: number }) => {
			const count = signal(props.initialCount);
			return { count };
		});

		const instance = CounterMolecule({ initialCount: 3 });
		trackMolecule(instance);

		expect(instance.count.value).toBe(3);
	});

	it("runs onMount callbacks when mounted and runs returned cleanups on dispose", () => {
		const cleanup = vi.fn();
		const mounts = vi.fn();

		const DemoMolecule = molecule(() => {
			onMount(() => {
				mounts();
				return () => {
					cleanup();
				};
			});

			return {};
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(mounts).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();

		mountMolecule(instance);
		expect(mounts).toHaveBeenCalledTimes(1);
		expect(cleanup).not.toHaveBeenCalled();

		disposeMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes child molecule when the parent is cleaned up", () => {
		const childCleanup = vi.fn();

		const ChildMolecule = molecule(() => {
			onDispose(() => {
				childCleanup();
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			use(ChildMolecule);
			return {};
		});

		const parent = ParentMolecule();
		trackMolecule(parent);

		disposeMolecule(parent);

		expect(childCleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes scope when setup throws", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onDispose(() => {
				cleanup();
			});

			throw new Error("boom");
		});

		expect(() => DemoMolecule()).toThrow("boom");
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposeTrackedMolecules tears down every tracked instance", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onDispose(() => {
				cleanup();
			});
			return {};
		});

		trackMolecule(DemoMolecule());
		trackMolecule(DemoMolecule());

		disposeTrackedMolecules();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it("mounts and unmounts child molecules along the parent molecule", () => {
		const events: string[] = [];

		const ChildMolecule = molecule(() => {
			onMount(() => {
				events.push("child-mount");
				return () => {
					events.push("child-unmount");
				};
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			use(ChildMolecule);
			onMount(() => {
				events.push("parent-mount");
				return () => {
					events.push("parent-unmount");
				};
			});
			return {};
		});

		const parent = ParentMolecule();
		trackMolecule(parent);

		mountMolecule(parent);
		expect(events).toEqual(["child-mount", "parent-mount"]);

		unmountMolecule(parent);
		expect(events).toEqual([
			"child-mount",
			"parent-mount",
			"child-unmount",
			"parent-unmount",
		]);
	});

	it("passes props to child molecule instances via use", () => {
		const ChildMolecule = molecule((props: { id: number }) => {
			const identifier = signal(props.id);
			return { identifier };
		});

		const ParentMolecule = molecule((props: { childId: number }) => {
			const child = use(ChildMolecule, { id: props.childId });
			return { child };
		});

		const parent = ParentMolecule({ childId: 42 });
		trackMolecule(parent);
		expect(parent.child.identifier.value).toBe(42);
	});

	it("throws when use is called outside molecule setup", () => {
		const ChildMolecule = molecule(() => ({}));

		expect(() => use(ChildMolecule)).toThrow(
			"use(...) can only be called synchronously during molecule setup.",
		);
	});
});
