import { describe, expect, it } from "vitest";
import {
	SubscriberFlags,
	decrementBatchDepth,
	endTracking,
	getActiveSub,
	getBatchDepth,
	incrementBatchDepth,
	link,
	processEffectNotifications,
	propagate,
	setActiveSub,
	startTracking,
	updateDirtyFlag,
} from "./index";
import type { Dependency, Subscriber } from "./index";

describe("reactive-system barrel exports", () => {
	it("exposes SubscriberFlags enum", () => {
		expect(SubscriberFlags.Computed).toBeTypeOf("number");
		expect(SubscriberFlags.Effect).toBeTypeOf("number");
	});

	it("exposes core functions that operate on reactive structures", () => {
		const dep: Dependency = { subs: undefined, subsTail: undefined };
		const sub: Subscriber = {
			flags: SubscriberFlags.Effect,
			deps: undefined,
			depsTail: undefined,
		};

		startTracking(sub);
		link(dep, sub);
		endTracking(sub);

		expect(typeof propagate).toBe("function");
		expect(typeof updateDirtyFlag).toBe("function");
		expect(typeof processEffectNotifications).toBe("function");
	});

	it("re-exports active subscriber helpers", () => {
		setActiveSub(undefined);
		expect(getActiveSub()).toBeUndefined();
	});

	it("re-exports batch helpers", () => {
		const initial = getBatchDepth();
		incrementBatchDepth();
		expect(getBatchDepth()).toBe(initial + 1);
		decrementBatchDepth();
	});
});
