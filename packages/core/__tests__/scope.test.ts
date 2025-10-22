import { afterEach, describe, expect, it } from "vitest";

import {
	ScopeCleanupErrorResponse,
	createScope,
	disposeScope,
	getCurrentScope,
	registerScopeCleanup,
	runWithScope,
	setScopeCleanupErrorHandler,
} from "../scope";

describe("reactivity scope", () => {
	afterEach(() => {
		setScopeCleanupErrorHandler(undefined);
	});

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
			registerScopeCleanup(() => {
				invoked.push("child");
			});
		});

		registerScopeCleanup(() => {
			invoked.push("root");
		}, rootScope);

		disposeScope(rootScope);

		expect(invoked).toEqual(["root", "child"]);
	});

	it("executes cleanup immediately when scope already disposed", () => {
		const scope = createScope();
		disposeScope(scope);

		let called = false;
		registerScopeCleanup(() => {
			called = true;
		}, scope);

		expect(called).toBe(true);
	});

	it("collects cleanup errors and rethrows as aggregate", () => {
		const scope = createScope();
		const order: string[] = [];

		runWithScope(scope, () => {
			registerScopeCleanup(() => {
				order.push("first");
			});
			registerScopeCleanup(() => {
				order.push("second");
				throw new Error("second failure");
			});
			registerScopeCleanup(() => {
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
		expect((aggregate.errors[0] as Error).message).toBe("third failure");
		expect((aggregate.errors[1] as Error).message).toBe("second failure");
	});

	it("allows handler to suppress cleanup errors", () => {
		setScopeCleanupErrorHandler(() => ScopeCleanupErrorResponse.Suppress);

		const scope = createScope();
		runWithScope(scope, () => {
			registerScopeCleanup(() => {
				throw new Error("should be suppressed");
			});
		});

		expect(() => disposeScope(scope)).not.toThrow();
	});

	it("surfaces immediate cleanup errors after suppression check", () => {
		const scope = createScope();
		const error = new Error("immediate failure");
		disposeScope(scope);

		expect(() =>
			registerScopeCleanup(() => {
				throw error;
			}, scope),
		).toThrowError(AggregateError);
	});
});
