import { describe, expect, it } from "vitest";

import {
	createScope,
	disposeScope,
	getCurrentScope,
	registerScopeCleanup,
	runWithScope,
} from ".";

describe("reactivity scope", () => {
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
});
