import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Scope,
	ScopeCleanupErrorResponse,
	computed,
	createComputedHandler,
	createDeepSignalHandler,
	createScope,
	createSignalHandler,
	deepSignal,
	disposeMolecule,
	disposeScope,
	disposeTrackedMolecules,
	get,
	getCurrentScope,
	isComputed,
	isDeepSignal,
	isMoleculeInstance,
	isRaw,
	isSignal,
	markRaw,
	molecule,
	mountMolecule,
	nextTick,
	onDispose,
	onMount,
	onUnmount,
	pauseTracking,
	readonly,
	readonlyDeepSignal,
	readonlyShallowDeepSignal,
	resumeTracking,
	runWithScope,
	setScopeCleanupErrorHandler,
	shallowDeepSignal,
	signal,
	toRawDeepSignal,
	toValue,
	trackMolecule,
	unmountMolecule,
	untracked,
	watch,
	watchEffect,
} from "..";

describe("public exports", () => {
	afterEach(() => {
		setScopeCleanupErrorHandler(undefined);
		disposeTrackedMolecules();
		vi.restoreAllMocks();
	});

	it("exposes reactive helpers and readonly wrappers from the package entry", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		const source = { count: signal(10), nested: { flag: false } };
		const state = deepSignal(source);
		const shallow = shallowDeepSignal({ count, nested: { flag: false } });
		const readonlyCount = readonly(count);
		const readonlyState = readonly(state);
		const deepReadonlyState = readonlyDeepSignal(state);
		const rawPayload = markRaw({ nested: { flag: false } });

		expect(isSignal(count)).toBe(true);
		expect(isSignal(readonlyCount)).toBe(true);
		expect(isSignal({ value: 1 })).toBe(false);

		expect(isComputed(doubled)).toBe(true);
		expect(isComputed({})).toBe(false);

		expect(isDeepSignal(state)).toBe(true);
		expect(isDeepSignal(source)).toBe(false);

		expect(readonlyCount.value).toBe(1);
		count.value = 2;
		expect(readonlyCount.value).toBe(2);
		expect(toValue(count)).toBe(2);
		expect(toValue(doubled)).toBe(4);
		expect(toValue(() => 5)).toBe(5);

		expect(readonlyState.count).toBe(10);
		expect(deepReadonlyState.nested.flag).toBe(false);
		source.count.value = 12;
		state.nested.flag = true;
		expect(readonlyState.count).toBe(12);
		expect(deepReadonlyState.nested.flag).toBe(true);

		expect(shallow.count).toBe(count);
		expect(isSignal(shallow.count)).toBe(true);
		expect(toRawDeepSignal(state)).toBe(source);

		expect(isRaw(rawPayload)).toBe(true);
		expect(isRaw({ nested: { flag: false } })).toBe(false);
		expect(isRaw(1)).toBe(false);
		expect(deepSignal(rawPayload)).toBe(rawPayload);
	});

	it("exposes readonlyShallowDeepSignal() from the package entry", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const source = { count: signal(1), nested: { flag: false } };
		const view = readonlyShallowDeepSignal(source);

		expect(view.count).toBe(source.count);
		expect(isSignal(view.count)).toBe(true);
		expect(toRawDeepSignal(view)).toBe(source);

		// @ts-expect-error runtime guard
		view.nested = { flag: true };
		expect(source.nested.flag).toBe(false);

		view.nested.flag = true;
		expect(source.nested.flag).toBe(true);

		const rawPayload = markRaw({ nested: { flag: false } });
		const preserved = readonlyShallowDeepSignal(rawPayload);
		expect(preserved).toBe(rawPayload);
		expect(toRawDeepSignal(preserved)).toBe(rawPayload);
	});

	it("exposes pauseTracking(), resumeTracking(), and untracked() from the package entry", async () => {
		const pausedCount = signal(0);
		let pausedRuns = 0;

		const stopPaused = watchEffect(() => {
			pausedRuns += 1;
			pauseTracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			pausedCount.value;
			resumeTracking();
		});

		pausedCount.value = 1;
		await nextTick();
		expect(pausedRuns).toBe(1);
		stopPaused();

		const untrackedCount = signal(0);
		let untrackedRuns = 0;

		const stopUntracked = watchEffect(() => {
			untrackedRuns += 1;
			untracked(() => {
				untrackedCount.value;
			});
		});

		untrackedCount.value = 1;
		await nextTick();
		expect(untrackedRuns).toBe(1);
		stopUntracked();

		const restoredCount = signal(0);
		let restoredRuns = 0;

		const stopRestored = watchEffect(() => {
			restoredRuns += 1;
			pauseTracking();
			expect(() =>
				untracked(() => {
					throw new Error("boom");
				}),
			).toThrow("boom");
			resumeTracking();
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			restoredCount.value;
		});

		restoredCount.value = 1;
		await nextTick();
		expect(restoredRuns).toBe(2);
		stopRestored();
	});

	it("exposes watch() and snapshot handlers from the package entry", async () => {
		const watched = signal(1);
		const seen: number[] = [];

		const stopWatch = watch(
			() => watched.value,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		watched.value = 2;
		await nextTick();
		expect(seen).toEqual([1, 2]);
		stopWatch();

		const count = signal(2);
		const doubled = computed(() => count.value * 2);
		const state = deepSignal({ count: 0 });

		const signalHandler = createSignalHandler(count);
		const computedHandler = createComputedHandler(doubled);
		const deepHandler = createDeepSignalHandler(state);

		const signalListener = vi.fn();
		const computedListener = vi.fn();
		const deepListener = vi.fn();

		const unsubscribeSignal = signalHandler.subscribe(signalListener);
		const unsubscribeComputed = computedHandler.subscribe(computedListener);
		const unsubscribeDeep = deepHandler.subscribe(deepListener);

		expect(signalHandler.getSnapshot()).toEqual({ value: 2, version: 0 });
		expect(computedHandler.getSnapshot()).toEqual({ value: 4, version: 0 });
		expect(deepHandler.getSnapshot().value.count).toBe(0);
		expect(deepHandler.getSnapshot().version).toBe(0);

		count.value = 3;
		state.count = 1;

		expect(signalListener).toHaveBeenCalledTimes(1);
		expect(computedListener).toHaveBeenCalledTimes(1);
		expect(deepListener).toHaveBeenCalledTimes(1);
		expect(signalHandler.getSnapshot()).toEqual({ value: 3, version: 1 });
		expect(computedHandler.getSnapshot()).toEqual({ value: 6, version: 1 });
		expect(deepHandler.getSnapshot().value.count).toBe(1);
		expect(deepHandler.getSnapshot().version).toBe(1);

		unsubscribeSignal();
		unsubscribeComputed();
		unsubscribeDeep();
	});

	it("exposes scope helpers from the package entry", () => {
		const parent = new Scope();
		const child = new Scope(parent);
		const skippedCleanup = vi.fn();
		const keptCleanup = vi.fn();

		const removeCleanup = child.addCleanup(skippedCleanup);
		child.addCleanup(keptCleanup);

		expect(child.parentScope).toBe(parent);
		expect(child.isDisposed).toBe(false);
		expect(child.id).not.toBe(parent.id);

		child.run(() => {
			expect(getCurrentScope()).toBe(child);
		});
		expect(getCurrentScope()).toBeUndefined();

		removeCleanup();
		child.dispose();
		child.dispose();

		expect(skippedCleanup).not.toHaveBeenCalled();
		expect(keptCleanup).toHaveBeenCalledTimes(1);
		expect(child.isDisposed).toBe(true);
		expect(() => child.run(() => undefined)).toThrow(
			"Cannot run code inside a disposed scope.",
		);

		const created = createScope(parent);
		const createdEvents: string[] = [];

		runWithScope(created, () => {
			expect(getCurrentScope()).toBe(created);
			onDispose(() => {
				createdEvents.push("created");
			});
		});

		disposeScope(created);
		expect(createdEvents).toEqual(["created"]);

		const suppressed = createScope();
		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Suppress);
		runWithScope(suppressed, () => {
			onDispose(() => {
				throw new Error("suppressed");
			});
		});
		expect(() => disposeScope(suppressed)).not.toThrow();

		const propagated = createScope();
		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Propagate);
		runWithScope(propagated, () => {
			onDispose(() => {
				throw new Error("propagated");
			});
		});
		expect(() => disposeScope(propagated)).toThrow("propagated");

		disposeScope(parent);
	});

	it("exposes molecule helpers from the package entry", () => {
		const childTeardown = vi.fn();
		const lifecycleEvents: string[] = [];

		const ChildMolecule = molecule(() => {
			onDispose(() => {
				childTeardown();
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			const count = signal(1);

			get(ChildMolecule);

			onMount(() => {
				lifecycleEvents.push("mount");
				return () => {
					lifecycleEvents.push("cleanup");
				};
			});

			onUnmount(() => {
				lifecycleEvents.push("unmount");
			});

			return { count };
		});

		const parent = ParentMolecule();
		trackMolecule(parent);

		expect(isMoleculeInstance(parent)).toBe(true);
		expect(parent.count.value).toBe(1);

		mountMolecule(parent);
		unmountMolecule(parent);
		expect(lifecycleEvents).toEqual(["mount", "unmount", "cleanup"]);

		disposeMolecule(parent);
		expect(childTeardown).toHaveBeenCalledTimes(1);
		expect(isMoleculeInstance(parent)).toBe(false);
	});

	it("exposes tracked molecule cleanup from the package entry", () => {
		const teardown = vi.fn();

		const DemoMolecule = molecule(() => {
			onDispose(() => {
				teardown();
			});
			return {};
		});

		trackMolecule(DemoMolecule());
		disposeTrackedMolecules();
		expect(teardown).toHaveBeenCalledTimes(1);
	});
});
