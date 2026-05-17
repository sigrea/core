import { describe, expectTypeOf, it } from "vitest";

import {
	computed,
	createSignalHandler,
	deepSignal,
	get,
	molecule,
	readonly,
	readonlyShallowDeepSignal,
	shallowDeepSignal,
	signal,
	toSignal,
	updateMoleculeProps,
	watch,
	watchEffect,
} from "..";

import type {
	Cleanup,
	DeepSignal,
	MoleculeArgs,
	MoleculeInstance,
	MoleculeSetupProps,
	ReadonlyDeepSignal,
	ReadonlyShallowDeepSignal,
	ReadonlySignal,
	ShallowDeepSignal,
	Signal,
	Snapshot,
	SnapshotHandler,
	WatchCallback,
	WatchEffectOptions,
	WatchHandle,
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
		const nestedSignal = toSignal(shallowState, "nested");
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
		expectTypeOf(nestedSignal).toEqualTypeOf<
			ReadonlySignal<{ flag: boolean }>
		>();
		const assertToSignalReadonly = () => {
			// @ts-expect-error toSignal returns a readonly view.
			nestedSignal.value = { flag: true };
		};
		void assertToSignalReadonly;

		const numberSource: WatchSource<number> = count;
		const objectSource: WatchSource<{ count: number }> = readonlyDeepState;
		const options: WatchOptions<true> = { immediate: true, flush: "post" };
		const effectOptions: WatchEffectOptions = { flush: "sync" };
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
		expectTypeOf(effectOptions).toEqualTypeOf<WatchEffectOptions>();
		expectTypeOf(callback).toEqualTypeOf<WatchCallback<number, number>>();

		const watchHandle = watch(numberSource, callback, options);
		expectTypeOf(watchHandle).toEqualTypeOf<WatchHandle>();
		expectTypeOf(watchHandle).toExtend<WatchStopHandle>();
		expectTypeOf(watchHandle.stop).toEqualTypeOf<() => void>();
		expectTypeOf(watchHandle.pause).toEqualTypeOf<() => void>();
		expectTypeOf(watchHandle.resume).toEqualTypeOf<() => void>();
		watchHandle.pause();
		watchHandle.resume();
		watchHandle.stop();
		watchHandle();

		const objectStop: WatchStopHandle = watch(
			objectSource,
			(value, oldValue) => {
				expectTypeOf(value.count).toEqualTypeOf<number>();
				expectTypeOf(oldValue.count).toEqualTypeOf<number>();
			},
		);
		objectStop();

		const tupleHandle = watch([count, doubled] as const, (value, oldValue) => {
			expectTypeOf(value).toEqualTypeOf<[number, number]>();
			expectTypeOf(oldValue).toEqualTypeOf<[number, number]>();
		});
		expectTypeOf(tupleHandle).toEqualTypeOf<WatchHandle>();
		tupleHandle.stop();

		const effectHandle = watchEffect(() => {}, effectOptions);
		expectTypeOf(effectHandle).toEqualTypeOf<WatchHandle>();
		effectHandle.stop();

		expectTypeOf(snapshotHandler).toEqualTypeOf<SnapshotHandler<number>>();
		expectTypeOf(snapshotHandler.getSnapshot()).toEqualTypeOf<
			Snapshot<number>
		>();

		type OptionalProps = { label?: string };
		const OptionalMolecule = molecule((props: OptionalProps) => {
			return {
				label: props.label ?? "default",
			};
		});
		const TypedPropsMolecule = molecule<OptionalProps, { label: string }>(
			(props) => {
				expectTypeOf(props).toEqualTypeOf<MoleculeSetupProps<OptionalProps>>();
				return {
					label: props.label ?? "default",
				};
			},
		);

		expectTypeOf<Parameters<typeof OptionalMolecule>>().toEqualTypeOf<
			MoleculeArgs<OptionalProps>
		>();

		const optionalInstance = OptionalMolecule();
		expectTypeOf(optionalInstance).toExtend<
			MoleculeInstance<{ label: string }>
		>();
		expectTypeOf(optionalInstance.label).toEqualTypeOf<string>();
		updateMoleculeProps(optionalInstance, { label: "next" });
		const assertUpdatePropsTypes = () => {
			updateMoleculeProps(optionalInstance, { label: "typed" });
			// @ts-expect-error update props must match the molecule props type
			updateMoleculeProps(optionalInstance, { wrong: true });
		};
		void assertUpdatePropsTypes;

		const typedPropsInstance = TypedPropsMolecule({ label: "typed" });
		expectTypeOf(typedPropsInstance.label).toEqualTypeOf<string>();

		const ChildMolecule = molecule((props: { id: number }) => ({
			id: props.id,
		}));
		const ParentMolecule = molecule((props: { childId: number }) => ({
			child: get(ChildMolecule, () => ({ id: props.childId })),
		}));
		const parentInstance = ParentMolecule({ childId: 1 });
		expectTypeOf(parentInstance.child).toExtend<
			MoleculeInstance<{ id: number }>
		>();
	});
});
