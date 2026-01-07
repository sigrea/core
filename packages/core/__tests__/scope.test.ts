import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ScopeCleanupErrorResponse,
	createScope,
	disposeScope,
	getCurrentScope,
	onDispose,
	runWithScope,
	setScopeCleanupErrorHandler,
} from "../scope";

describe("reactivity scope", () => {
	afterEach(() => {
		setScopeCleanupErrorHandler(undefined);
	});

	const suppressConsoleError = () =>
		vi.spyOn(console, "error").mockImplementation(() => {});

	it("activates scope while running and restores afterwards", () => {
		const scope = createScope();
		let activeDuringRun = false;
		let activeAfterRun = true;

		runWithScope(scope, () => {
			activeDuringRun = getCurrentScope() === scope;
		});

		activeAfterRun = getCurrentScope() === undefined;

		expect(activeDuringRun).toBe(true);
		expect(activeAfterRun).toBe(true);
	});

	it("runs registered cleanups when scope is disposed", () => {
		const rootScope = createScope();
		const childScope = createScope(rootScope);
		const invoked: string[] = [];

		runWithScope(childScope, () => {
			onDispose(() => {
				invoked.push("child");
			});
		});

		onDispose(() => {
			invoked.push("root");
		}, rootScope);

		disposeScope(rootScope);

		expect(invoked).toEqual(["root", "child"]);
	});

	it("executes cleanup immediately when scope already disposed", () => {
		const scope = createScope();
		disposeScope(scope);

		let called = false;
		onDispose(() => {
			called = true;
		}, scope);

		expect(called).toBe(true);
	});

	it("continues running remaining cleanups when cleanups throw", () => {
		const errorSpy = suppressConsoleError();
		try {
			const scope = createScope();
			const order: string[] = [];

			runWithScope(scope, () => {
				onDispose(() => {
					order.push("first");
				});
				onDispose(() => {
					order.push("second");
					throw new Error("second failure");
				});
				onDispose(() => {
					order.push("third");
					throw new Error("third failure");
				});
			});

			let caught: unknown;
			try {
				disposeScope(scope);
			} catch (error) {
				caught = error;
			}

			expect(order).toEqual(["third", "second", "first"]);
			expect(caught).toBeInstanceOf(AggregateError);
			const aggregate = caught as AggregateError;
			expect(aggregate.errors).toHaveLength(2);
			expect(aggregate.errors[0]).toBeInstanceOf(Error);
			expect((aggregate.errors[0] as Error).message).toBe("third failure");
			expect((aggregate.errors[1] as Error).message).toBe("second failure");
			// expect(errorSpy).toHaveBeenCalledTimes(2);
		} finally {
			errorSpy.mockRestore();
		}
	});

	it("propagates cleanup errors when handler requests it", () => {
		const scope = createScope();
		const failure = new Error("boom");

		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Propagate);

		runWithScope(scope, () => {
			onDispose(() => {
				throw failure;
			});
		});

		expect(() => disposeScope(scope)).toThrow(failure);
	});

	it("allows handler to suppress cleanup errors", () => {
		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Suppress);

		const scope = createScope();
		runWithScope(scope, () => {
			onDispose(() => {
				throw new Error("should be suppressed");
			});
		});

		expect(() => disposeScope(scope)).not.toThrow();
	});

	it("runs cleanup immediately when invoked without an active scope", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		let runs = 0;

		onDispose(() => {
			runs += 1;
		});

		expect(runs).toBe(1);
		// expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it("aggregates immediate cleanup errors by default", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const errorSpy = suppressConsoleError();
		try {
			const failure = new Error("immediate failure");
			expect(() =>
				onDispose(() => {
					throw failure;
				}),
			).toThrow(AggregateError);
			// expect(errorSpy).toHaveBeenCalledTimes(1);
		} finally {
			errorSpy.mockRestore();
		}
		warn.mockRestore();
	});

	it("propagates immediate cleanup errors when handler opts in", () => {
		const scope = createScope();
		disposeScope(scope);
		const failure = new Error("immediate failure");

		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Propagate);

		expect(() =>
			onDispose(() => {
				throw failure;
			}, scope),
		).toThrow(failure);
	});
});
