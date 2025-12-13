import { afterEach, describe, expect, it, vi } from "vitest";

import {
	cleanupMolecule,
	cleanupMolecules,
	computed,
	deepSignal,
	isComputed,
	isDeepSignal,
	isMoleculeInstance,
	isSignal,
	molecule,
	mountMolecule,
	nextTick,
	onUnmount,
	pauseTracking,
	resumeTracking,
	signal,
	toValue,
	use,
	useMolecule,
	watchEffect,
} from "..";

describe("public exports", () => {
	afterEach(() => {
		cleanupMolecules();
	});

	it("exposes isSignal() and toValue() from the package entry", () => {
		const count = signal(1);
		const getter = () => 5;

		expect(isSignal(count)).toBe(true);
		expect(isSignal({ value: 1 })).toBe(false);
		expect(toValue(count)).toBe(1);
		expect(toValue(getter)).toBe(5);
	});

	it("exposes isComputed() and isDeepSignal() helpers", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		const state = deepSignal({ count: 0 });

		expect(isComputed(doubled)).toBe(true);
		expect(isComputed({})).toBe(false);
		expect(isDeepSignal(state)).toBe(true);
		expect(isDeepSignal({})).toBe(false);
	});

	it("exposes pauseTracking()/resumeTracking() helpers", async () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			pauseTracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			count.value;
			resumeTracking();
		});

		expect(runs).toBe(1);
		count.value = 1;
		await nextTick();
		expect(runs).toBe(1);
		stop();
	});

	it("exposes molecule helpers from the package entry", () => {
		const teardown = vi.fn();
		const childTeardown = vi.fn();

		const DemoMolecule = molecule(() => {
			const count = signal(1);
			onUnmount(() => {
				teardown();
			});
			return { count };
		});

		const ChildMolecule = molecule(() => {
			onUnmount(() => {
				childTeardown();
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			use(ChildMolecule);
			return {};
		});

		const instance = useMolecule(DemoMolecule);
		expect(isMoleculeInstance(instance)).toBe(true);
		expect(instance.count.value).toBe(1);

		const mounted = mountMolecule(DemoMolecule);
		expect(isMoleculeInstance(mounted)).toBe(true);

		const parent = mountMolecule(ParentMolecule);
		expect(isMoleculeInstance(parent)).toBe(true);

		cleanupMolecule(parent);
		expect(childTeardown).toHaveBeenCalledTimes(1);

		cleanupMolecule(instance);
		expect(teardown).toHaveBeenCalledTimes(1);
	});
});
