import { describe, expectTypeOf, it } from "vitest";

import {
	computed,
	createSignalHandler,
	deepSignal,
	molecule,
	readonly,
	readonlyShallowDeepSignal,
	shallowDeepSignal,
	signal,
	watch,
} from "..";

import type {
	Cleanup,
	DeepSignal,
	MoleculeArgs,
	MoleculeInstance,
	ReadonlyDeepSignal,
	ReadonlyShallowDeepSignal,
	ReadonlySignal,
	ShallowDeepSignal,
	Signal,
	Snapshot,
	SnapshotHandler,
	WatchCallback,
	WatchOptions,
	WatchSource,
	WatchStopHandle,
} from "..";

describe("public types", () => {
	it("exposes public root type contracts", () => {
		const count = signal(1);
		const doubled = computed(() => count.value * 2);
		const readonlyCount = readonly(count);
		const deepState = deepSignal({ count, nested: { label: "demo" } });
		const readonlyDeepState = readonly(deepSignal({ count: 1 }));
		const shallowState = shallowDeepSignal({ count, nested: { flag: false } });
		const readonlyShallowState = readonlyShallowDeepSignal({
			count,
			nested: { flag: false },
		});
		const snapshotHandler = createSignalHandler(count);

		expectTypeOf(count).toEqualTypeOf<Signal<number>>();
		expectTypeOf(readonlyCount).toEqualTypeOf<ReadonlySignal<number>>();
		expectTypeOf(deepState).toMatchTypeOf<
			DeepSignal<{ count: Signal<number>; nested: { label: string } }>
		>();
		expectTypeOf(readonlyDeepState).toMatchTypeOf<
			ReadonlyDeepSignal<{ count: number }>
		>();
		expectTypeOf(shallowState).toMatchTypeOf<
			ShallowDeepSignal<{ count: Signal<number>; nested: { flag: boolean } }>
		>();
		expectTypeOf(readonlyShallowState).toMatchTypeOf<
			ReadonlyShallowDeepSignal<{
				count: Signal<number>;
				nested: { flag: boolean };
			}>
		>();
		expectTypeOf(readonlyShallowState.count).toEqualTypeOf<Signal<number>>();

		const numberSource: WatchSource<number> = count;
		const objectSource: WatchSource<{ count: number }> = readonlyDeepState;
		const options: WatchOptions<true> = { immediate: true, flush: "post" };
		const callback: WatchCallback<number, number> = (
			value,
			oldValue,
			onCleanup,
		) => {
			expectTypeOf(value).toEqualTypeOf<number>();
			expectTypeOf(oldValue).toEqualTypeOf<number>();
			expectTypeOf(onCleanup).parameter(0).toEqualTypeOf<Cleanup>();
		};

		expectTypeOf(options).toEqualTypeOf<WatchOptions<true>>();
		expectTypeOf(callback).toEqualTypeOf<WatchCallback<number, number>>();

		const singleStop: WatchStopHandle = watch(numberSource, callback, options);
		singleStop();

		const objectStop: WatchStopHandle = watch(
			objectSource,
			(value, oldValue) => {
				expectTypeOf(value.count).toEqualTypeOf<number>();
				expectTypeOf(oldValue.count).toEqualTypeOf<number>();
			},
		);
		objectStop();

		const tupleStop: WatchStopHandle = watch(
			[count, doubled] as const,
			(value, oldValue) => {
				expectTypeOf(value).toEqualTypeOf<[number, number]>();
				expectTypeOf(oldValue).toEqualTypeOf<[number, number]>();
			},
		);
		tupleStop();

		expectTypeOf(snapshotHandler).toEqualTypeOf<SnapshotHandler<number>>();
		expectTypeOf(snapshotHandler.getSnapshot()).toEqualTypeOf<
			Snapshot<number>
		>();

		type OptionalProps = { label?: string };
		const OptionalMolecule = molecule((props: OptionalProps) => ({
			label: props.label ?? "default",
		}));

		expectTypeOf<Parameters<typeof OptionalMolecule>>().toEqualTypeOf<
			MoleculeArgs<OptionalProps>
		>();

		const optionalInstance = OptionalMolecule();
		expectTypeOf(optionalInstance).toExtend<
			MoleculeInstance<{ label: string }>
		>();
		expectTypeOf(optionalInstance.label).toEqualTypeOf<string>();
	});
});
