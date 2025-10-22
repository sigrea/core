export type Cleanup = () => void;

export class Scope {
	private readonly cleanups = new Set<Cleanup>();
	private disposed = false;
	private removeFromParent: (() => void) | undefined;

	constructor(private readonly parent?: Scope) {}

	run<T>(callback: () => T): T {
		if (this.disposed) {
			throw new Error("Cannot run code inside a disposed scope.");
		}

		const previous = setActiveScope(this);
		try {
			return callback();
		} finally {
			setActiveScope(previous);
		}
	}

	addCleanup(cleanup: Cleanup): () => void {
		if (this.disposed) {
			// If the scope is already disposed, execute immediately to avoid leaks.
			cleanup();
			return () => {
				// noop removal; cleanup already executed.
			};
		}

		this.cleanups.add(cleanup);
		let removed = false;
		return () => {
			if (removed) {
				return;
			}
			removed = true;
			this.cleanups.delete(cleanup);
		};
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;

		if (this.removeFromParent !== undefined) {
			const detach = this.removeFromParent;
			this.removeFromParent = undefined;
			detach();
		}

		const cleanups = Array.from(this.cleanups);
		this.cleanups.clear();

		for (let index = cleanups.length - 1; index >= 0; index -= 1) {
			const cleanup = cleanups[index];
			try {
				cleanup();
			} catch {
				// TODO(sigrea-reactivity): Consider surfacing cleanup errors via user-provided logger hook.
			}
		}
	}

	attachToParent(detach: () => void): void {
		this.removeFromParent = detach;
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	get parentScope(): Scope | undefined {
		return this.parent;
	}
}

let activeScope: Scope | undefined;

function setActiveScope(scope: Scope | undefined): Scope | undefined {
	const previous = activeScope;
	activeScope = scope;
	return previous;
}

export function createScope(parent?: Scope): Scope {
	const scope = new Scope(parent);
	if (parent !== undefined) {
		const detach = parent.addCleanup(() => scope.dispose());
		scope.attachToParent(detach);
	}
	return scope;
}

export function runWithScope<T>(scope: Scope, callback: () => T): T {
	return scope.run(callback);
}

export function getCurrentScope(): Scope | undefined {
	return activeScope;
}

export function registerScopeCleanup(
	cleanup: Cleanup,
	scope: Scope | undefined = activeScope,
): () => void {
	if (scope === undefined) {
		return () => {
			// No active scope; caller retains responsibility for manual cleanup.
		};
	}

	return scope.addCleanup(cleanup);
}

export function disposeScope(scope: Scope): void {
	scope.dispose();
}
