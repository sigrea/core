import { type Scope, disposeScope, registerScopeCleanup } from "../core/scope";

import type { MoleculeInstance } from "./types";

export interface MoleculeMetadata {
	target: object;
	scope: Scope;
	disposed: boolean;
	parent?: MoleculeMetadata;
	children: Set<MoleculeMetadata>;
}

const moleculeMetadataMap = new WeakMap<object, MoleculeMetadata>();

function collectErrors(target: unknown, errors: unknown[]): void {
	if (target instanceof AggregateError) {
		for (const error of target.errors) {
			errors.push(error);
		}
		return;
	}
	errors.push(target);
}

export function createMetadata(scope: Scope): MoleculeMetadata {
	return {
		// Temporary placeholder; will be set in finalizeMetadata.
		target: {} as object,
		scope,
		disposed: false,
		children: new Set(),
	};
}

export function finalizeMetadata(
	metadata: MoleculeMetadata,
	target: object,
): void {
	metadata.target = target;
	moleculeMetadataMap.set(target, metadata);
}

export function getMoleculeMetadata(
	value: unknown,
): MoleculeMetadata | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	return moleculeMetadataMap.get(value as object);
}

export function disposeMoleculeInstance(metadata: MoleculeMetadata): void {
	if (metadata.disposed) {
		return;
	}
	metadata.disposed = true;

	moleculeMetadataMap.delete(metadata.target);

	const children = Array.from(metadata.children);
	metadata.children.clear();
	const errors: unknown[] = [];

	for (const child of children) {
		try {
			disposeMoleculeInstance(child);
		} catch (error) {
			collectErrors(error, errors);
		}
	}

	try {
		disposeScope(metadata.scope);
	} catch (error) {
		collectErrors(error, errors);
	}

	if (metadata.parent !== undefined) {
		metadata.parent.children.delete(metadata);
		metadata.parent = undefined;
	}

	if (errors.length > 0) {
		throw new AggregateError(errors, "Failed to dispose molecule instance.");
	}
}

export function disposeMolecule<T extends object>(
	value: MoleculeInstance<T>,
): void {
	const metadata = getMoleculeMetadata(value);
	if (metadata !== undefined) {
		disposeMoleculeInstance(metadata);
	}
}

export function linkChildMolecule<T extends object>(
	parent: MoleculeMetadata,
	child: MoleculeMetadata,
	instance: MoleculeInstance<T>,
): MoleculeInstance<T> {
	if (child.disposed) {
		throw new Error(
			"Cannot link a disposed molecule instance. Create a new instance instead.",
		);
	}

	if (child.parent === undefined) {
		child.parent = parent;
		parent.children.add(child);
		registerScopeCleanup(() => disposeMoleculeInstance(child), parent.scope);
	} else if (child.parent !== parent) {
		throw new Error(
			"Molecule instance is already linked to a different parent. Create a new instance for each parent molecule.",
		);
	}

	return instance;
}
