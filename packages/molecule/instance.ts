import { getMoleculeMetadata } from "./internals";
import type { MoleculeInstance } from "./types";

export function isMoleculeInstance<T extends object>(
	value: unknown,
): value is MoleculeInstance<T> {
	return getMoleculeMetadata(value) !== undefined;
}
