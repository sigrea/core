import {
	type ReadonlyShallowDeepSignal,
	type ShallowDeepSignal,
	readonlyShallowDeepSignal,
	shallowDeepSignal,
	toRawDeepSignal,
} from "../core/deepSignal";
import { batch } from "../core/reactivity";

import type {
	MoleculePropsInput,
	MoleculeSetupProps,
	ResolvedMoleculeProps,
} from "./types";

const INVALID_MOLECULE_PROPS_MESSAGE = "molecule props must be a plain object.";

export interface MoleculePropsStore<TProps extends object = object> {
	readonly state: ShallowDeepSignal<TProps>;
	readonly readonlyState: ReadonlyShallowDeepSignal<TProps>;
}

export function snapshotMoleculeProps<TProps extends object>(
	props: TProps,
): TProps {
	assertMoleculeProps(props);
	return { ...props };
}

export function assertMoleculeProps(props: unknown): asserts props is object {
	if (!isPlainObjectContainer(props)) {
		throw new TypeError(INVALID_MOLECULE_PROPS_MESSAGE);
	}
}

function isPlainObjectContainer(value: unknown): value is object {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export function createMoleculeProps<TProps extends MoleculePropsInput>(
	props: ResolvedMoleculeProps<TProps>,
): MoleculePropsStore<ResolvedMoleculeProps<TProps>> {
	const state = shallowDeepSignal(snapshotMoleculeProps(props));
	const rawState = toRawDeepSignal(
		state as object,
	) as ResolvedMoleculeProps<TProps>;

	return {
		state,
		readonlyState: readonlyShallowDeepSignal(
			rawState,
		) as ReadonlyShallowDeepSignal<ResolvedMoleculeProps<TProps>>,
	};
}

export function replaceMoleculeProps<TProps extends object>(
	store: MoleculePropsStore<TProps>,
	nextProps: TProps,
): void {
	const state = store.state as Record<PropertyKey, unknown>;
	const rawState = toRawDeepSignal(store.state) as Record<PropertyKey, unknown>;
	const next = snapshotMoleculeProps(nextProps) as Record<PropertyKey, unknown>;
	const nextKeys = new Set(Reflect.ownKeys(next));

	batch(() => {
		for (const key of Reflect.ownKeys(rawState)) {
			if (!nextKeys.has(key)) {
				delete state[key];
			}
		}

		for (const key of nextKeys) {
			state[key] = next[key];
		}
	});
}

export function readMoleculeProps<TProps extends MoleculePropsInput>(
	store: MoleculePropsStore<ResolvedMoleculeProps<TProps>>,
): MoleculeSetupProps<TProps> {
	return store.readonlyState as MoleculeSetupProps<TProps>;
}
