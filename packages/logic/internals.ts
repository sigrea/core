import { type Scope, disposeScope, registerScopeCleanup } from "../core/scope";

import type { LogicInstance } from "./types";

export interface LogicMetadata {
	target: object;
	scope: Scope;
	disposed: boolean;
	parent?: LogicMetadata;
	children: Set<LogicMetadata>;
}

const logicMetadataMap = new WeakMap<object, LogicMetadata>();

export function createMetadata(scope: Scope): LogicMetadata {
	return {
		// Temporary placeholder; will be set in finalizeMetadata.
		target: {} as object,
		scope,
		disposed: false,
		children: new Set(),
	};
}

export function finalizeMetadata(
	metadata: LogicMetadata,
	target: object,
): void {
	metadata.target = target;
	logicMetadataMap.set(target, metadata);
}

export function getLogicMetadata(value: unknown): LogicMetadata | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	return logicMetadataMap.get(value as object);
}

export function disposeLogicInstance(metadata: LogicMetadata): void {
	if (metadata.disposed) {
		return;
	}
	metadata.disposed = true;

	logicMetadataMap.delete(metadata.target);

	const children = Array.from(metadata.children);
	metadata.children.clear();
	for (const child of children) {
		disposeLogicInstance(child);
	}

	disposeScope(metadata.scope);

	if (metadata.parent !== undefined) {
		metadata.parent.children.delete(metadata);
		metadata.parent = undefined;
	}
}

export function disposeLogic<T extends object>(value: LogicInstance<T>): void {
	const metadata = getLogicMetadata(value);
	if (metadata !== undefined) {
		disposeLogicInstance(metadata);
	}
}

export function linkChildLogic<T extends object>(
	parent: LogicMetadata,
	child: LogicMetadata,
	instance: LogicInstance<T>,
): LogicInstance<T> {
	if (child.disposed) {
		throw new Error(
			"Cannot link a disposed logic instance. Create a new instance instead.",
		);
	}

	if (child.parent === undefined) {
		child.parent = parent;
		parent.children.add(child);
		registerScopeCleanup(() => disposeLogicInstance(child), parent.scope);
	} else if (child.parent !== parent) {
		throw new Error(
			"Logic instance is already linked to a different parent. Create a new instance for each parent logic.",
		);
	}

	return instance;
}
