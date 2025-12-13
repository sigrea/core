import { isMoleculeInstance } from "./instance";
import { disposeMolecule } from "./internals";
import type { MoleculeArgs, MoleculeFactory, MoleculeInstance } from "./types";

const tracked = new Set<MoleculeInstance<object>>();

function collectErrors(target: unknown, errors: unknown[]): void {
	if (target instanceof AggregateError) {
		for (const error of target.errors) {
			errors.push(error);
		}
		return;
	}
	errors.push(target);
}

export function mountMolecule<T extends object, P = void>(
	molecule: MoleculeFactory<T, P>,
	...args: MoleculeArgs<P>
): MoleculeInstance<T> {
	const instance = molecule(...args);
	tracked.add(instance as MoleculeInstance<object>);
	return instance;
}

export function useMolecule<T extends object, P = void>(
	molecule: MoleculeFactory<T, P>,
	...args: MoleculeArgs<P>
): MoleculeInstance<T> {
	return mountMolecule(molecule, ...args);
}

export function cleanupMolecule<T extends object>(
	instance: MoleculeInstance<T>,
): void {
	if (!isMoleculeInstance(instance)) {
		return;
	}
	disposeMolecule(instance);
	tracked.delete(instance as MoleculeInstance<object>);
}

export function cleanupMolecules(): void {
	const errors: unknown[] = [];

	for (const instance of tracked) {
		try {
			disposeMolecule(instance);
		} catch (error) {
			collectErrors(error, errors);
		}
	}
	tracked.clear();

	if (errors.length > 0) {
		throw new AggregateError(
			errors,
			"Failed to cleanup tracked molecule instances.",
		);
	}
}
