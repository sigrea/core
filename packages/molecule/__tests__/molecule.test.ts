import { afterEach, describe, expect, it, vi } from "vitest";

import { computed } from "../../core/computed";
import { signal } from "../../core/signal";
import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { disposeMolecule } from "../internals";
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

	it("runs onUnmount cleanups when molecule is disposed", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onMount(() => {
				return () => {
					cleanup();
				};
			});

			return {};
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(cleanup).not.toHaveBeenCalled();

		disposeMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes child molecule when the parent is cleaned up", () => {
		const childCleanup = vi.fn();

		const ChildMolecule = molecule(() => {
			onUnmount(() => {
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
			onMount(() => {
				return () => {
					cleanup();
				};
			});

			throw new Error("boom");
		});

		expect(() => DemoMolecule()).toThrow("boom");
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposeTrackedMolecules tears down every tracked instance", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		trackMolecule(DemoMolecule());
		trackMolecule(DemoMolecule());

		disposeTrackedMolecules();

		expect(cleanup).toHaveBeenCalledTimes(2);
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
