import {
	getActiveMoleculeMetadata,
	getMoleculeMetadata,
	linkChildMolecule,
} from "./internals";
import type { MoleculeArgs, MoleculeFactory, MoleculeInstance } from "./types";

const USE_OUTSIDE_SETUP_MESSAGE =
	"use(...) can only be called synchronously during molecule setup.";
const INVALID_MOLECULE_FACTORY_MESSAGE =
	"use(...) expects a molecule factory returned by molecule().";

export function use<TReturn extends object, TProps = void>(
	childFactory: MoleculeFactory<TReturn, TProps>,
	...args: MoleculeArgs<TProps>
): MoleculeInstance<TReturn> {
	const parentMetadata = getActiveMoleculeMetadata();
	if (parentMetadata === undefined) {
		throw new Error(USE_OUTSIDE_SETUP_MESSAGE);
	}

	if (typeof childFactory !== "function") {
		throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
	}

	const child = childFactory(...args);
	const childMetadata = getMoleculeMetadata(child);

	if (childMetadata === undefined) {
		throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
	}

	return linkChildMolecule(parentMetadata, childMetadata, child);
}
