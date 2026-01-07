import {
	type Scope,
	createScope,
	disposeScope,
	onDispose,
	registerScopeCleanup,
	runWithScope,
} from "../core/scope";

import type { MoleculeInstance } from "./types";

export interface MoleculeMetadata {
	target: object;
	scope: Scope;
	mountScope?: Scope;
	mountJobs: Array<() => void>;
	disposed: boolean;
	parent?: MoleculeMetadata;
	children: Set<MoleculeMetadata>;
}

const moleculeMetadataMap = new WeakMap<object, MoleculeMetadata>();
const activeMetadataStack: MoleculeMetadata[] = [];

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
		mountJobs: [],
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

	const errors: unknown[] = [];

	if (metadata.mountScope !== undefined) {
		try {
			unmountMoleculeInstance(metadata);
		} catch (error) {
			collectErrors(error, errors);
		}
	}

	const children = Array.from(metadata.children);
	metadata.children.clear();

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

function mountMoleculeInstance(metadata: MoleculeMetadata): void {
	if (metadata.disposed || metadata.mountScope !== undefined) {
		return;
	}

	const parentMountScope = metadata.parent?.mountScope;
	const mountScope = createScope(parentMountScope);
	metadata.mountScope = mountScope;

	onDispose(() => {
		if (metadata.mountScope === mountScope) {
			metadata.mountScope = undefined;
		}
	}, mountScope);

	registerScopeCleanup(() => {
		disposeScope(mountScope);
	}, metadata.scope);

	for (const child of metadata.children) {
		mountMoleculeInstance(child);
	}

	try {
		runWithScope(mountScope, () => {
			for (const job of metadata.mountJobs) {
				job();
			}
		});
	} catch (error) {
		try {
			disposeScope(mountScope);
		} catch (cleanupError) {
			const aggregated: unknown[] =
				cleanupError instanceof AggregateError
					? [...cleanupError.errors]
					: [cleanupError];
			aggregated.push(error);
			throw new AggregateError(
				aggregated,
				"Failed to mount molecule instance; cleanup also encountered errors.",
			);
		}
		throw error;
	}
}

function unmountMoleculeInstance(metadata: MoleculeMetadata): void {
	if (metadata.disposed || metadata.mountScope === undefined) {
		return;
	}

	for (const child of metadata.children) {
		unmountMoleculeInstance(child);
	}

	const mountScope = metadata.mountScope;
	disposeScope(mountScope);
}

export function mountMolecule<T extends object>(
	value: MoleculeInstance<T>,
): void {
	const metadata = getMoleculeMetadata(value);
	if (metadata !== undefined) {
		mountMoleculeInstance(metadata);
	}
}

export function unmountMolecule<T extends object>(
	value: MoleculeInstance<T>,
): void {
	const metadata = getMoleculeMetadata(value);
	if (metadata !== undefined) {
		unmountMoleculeInstance(metadata);
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

export function pushActiveMoleculeMetadata(metadata: MoleculeMetadata): void {
	activeMetadataStack.push(metadata);
}

export function popActiveMoleculeMetadata(metadata: MoleculeMetadata): void {
	const current = activeMetadataStack[activeMetadataStack.length - 1];
	if (current !== metadata) {
		throw new Error("Molecule setup stack is corrupted.");
	}
	activeMetadataStack.pop();
}

export function getActiveMoleculeMetadata(): MoleculeMetadata | undefined {
	return activeMetadataStack[activeMetadataStack.length - 1];
}
