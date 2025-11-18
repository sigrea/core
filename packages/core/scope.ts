export type Cleanup = () => void;

export type ScopeCleanupPhase = "dispose" | "immediate";

export interface ScopeCleanupErrorContext {
	scope?: Scope;
	scopeId: number;
	cleanup: Cleanup;
	index: number;
	total: number;
	phase: ScopeCleanupPhase;
}

export enum ScopeCleanupErrorResponse {
	Propagate = "propagate",
	Suppress = "suppress",
}

export type ScopeCleanupErrorHandler = (
	error: unknown,
	context: ScopeCleanupErrorContext,
) => ScopeCleanupErrorResponse | void;

let cleanupErrorHandler: ScopeCleanupErrorHandler | undefined;

export function setScopeCleanupErrorHandler(
	handler?: ScopeCleanupErrorHandler,
): void {
	cleanupErrorHandler = handler;
}

let nextScopeId = 1;

function resolveCleanupErrorResponse(
	scope: Scope | undefined,
	cleanup: Cleanup,
	index: number,
	total: number,
	phase: ScopeCleanupPhase,
	error: unknown,
): ScopeCleanupErrorResponse | undefined {
	if (cleanupErrorHandler !== undefined) {
		try {
			const response = cleanupErrorHandler(error, {
				scope,
				scopeId: scope?.id ?? -1,
				cleanup,
				index,
				total,
				phase,
			});

			if (response === ScopeCleanupErrorResponse.Suppress) {
				return ScopeCleanupErrorResponse.Suppress;
			}

			if (response === ScopeCleanupErrorResponse.Propagate) {
				return ScopeCleanupErrorResponse.Propagate;
			}
		} catch (handlerError) {
			if (process.env.NODE_ENV !== "production") {
				console.error(
					"Scope cleanup error handler threw an error.",
					handlerError,
				);
			}
			return undefined;
		}
	}

	if (process.env.NODE_ENV !== "production") {
		const phaseLabel =
			phase === "dispose"
				? "Scope cleanup failed"
				: "Immediate scope cleanup failed";
		const scopeLabel = scope !== undefined ? ` (scope #${scope.id})` : "";
		console.error(`${phaseLabel}${scopeLabel}.`, error);
	}
	return undefined;
}

function runCleanupWithHandling(
	scope: Scope | undefined,
	cleanup: Cleanup,
	index: number,
	total: number,
	phase: ScopeCleanupPhase,
	errors?: unknown[],
): void {
	try {
		cleanup();
	} catch (error) {
		const response = resolveCleanupErrorResponse(
			scope,
			cleanup,
			index,
			total,
			phase,
			error,
		);
		if (response === ScopeCleanupErrorResponse.Propagate) {
			throw error;
		}
		if (
			response !== ScopeCleanupErrorResponse.Suppress &&
			errors !== undefined
		) {
			errors.push(error);
		}
	}
}

function throwAggregateCleanupError(
	errors: unknown[],
	scope: Scope | undefined,
	phase: ScopeCleanupPhase,
): void {
	if (errors.length === 0) {
		return;
	}
	const scopeLabel = scope !== undefined ? ` (scope #${scope.id})` : "";
	const phaseLabel =
		phase === "dispose"
			? "Failed to dispose scope"
			: "Failed to run scope cleanup";
	throw new AggregateError(errors, `${phaseLabel}${scopeLabel}.`);
}

export class Scope {
	private readonly cleanups = new Set<Cleanup>();
	private disposed = false;
	private removeFromParent: (() => void) | undefined;
	private readonly scopeId = nextScopeId++;

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
			const errors: unknown[] = [];
			runCleanupWithHandling(this, cleanup, 0, 1, "immediate", errors);
			throwAggregateCleanupError(errors, this, "immediate");
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

		const total = cleanups.length;
		const errors: unknown[] = [];

		for (let index = cleanups.length - 1; index >= 0; index -= 1) {
			const cleanup = cleanups[index];
			const executionIndex = total - 1 - index;
			runCleanupWithHandling(
				this,
				cleanup,
				executionIndex,
				total,
				"dispose",
				errors,
			);
		}

		throwAggregateCleanupError(errors, this, "dispose");
	}

	attachToParent(detach: () => void): void {
		this.removeFromParent = detach;
	}

	get isDisposed(): boolean {
		return this.disposed;
	}

	get id(): number {
		return this.scopeId;
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
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				"registerScopeCleanup() called with no active scope; cleanup runs immediately.",
			);
		}
		const errors: unknown[] = [];
		runCleanupWithHandling(undefined, cleanup, 0, 1, "immediate", errors);
		throwAggregateCleanupError(errors, undefined, "immediate");
		return () => {
			// cleanup already executed; nothing to remove.
		};
	}

	return scope.addCleanup(cleanup);
}

export function disposeScope(scope: Scope): void {
	scope.dispose();
}
