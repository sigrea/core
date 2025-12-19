import { isMoleculeInstance } from "./instance";
import { disposeMolecule } from "./internals";
import type { MoleculeInstance } from "./types";

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

export function trackMolecule<T extends object>(
	instance: MoleculeInstance<T>,
): void {
	if (!isMoleculeInstance(instance)) {
		return;
	}
	tracked.add(instance as MoleculeInstance<object>);
}

export function cleanupTrackedMolecules(): void {
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
