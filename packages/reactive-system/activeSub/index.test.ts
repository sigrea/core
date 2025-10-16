import { describe, expect, it } from "vitest";
import type { Subscriber } from "../core";
import { SubscriberFlags } from "../core";
import { activeSub, getActiveSub, setActiveSub } from "./index";

describe("reactive-system/activeSub", () => {
	it("returns undefined when no subscriber is active", () => {
		setActiveSub(undefined);
		expect(getActiveSub()).toBeUndefined();
		expect(activeSub).toBeUndefined();
	});

	it("stores and restores the active subscriber", () => {
		const sub = {
			flags: SubscriberFlags.Effect,
			deps: undefined,
			depsTail: undefined,
		} satisfies Subscriber;

		setActiveSub(sub);
		expect(getActiveSub()).toBe(sub);
		expect(activeSub).toBe(sub);

		setActiveSub(undefined);
		expect(getActiveSub()).toBeUndefined();
		expect(activeSub).toBeUndefined();
	});

	it("allows nested active subscriber scopes", () => {
		const outer = {
			flags: SubscriberFlags.Effect,
			deps: undefined,
			depsTail: undefined,
		} satisfies Subscriber;
		const inner = {
			flags: SubscriberFlags.Effect,
			deps: undefined,
			depsTail: undefined,
		} satisfies Subscriber;

		setActiveSub(outer);
		expect(getActiveSub()).toBe(outer);

		setActiveSub(inner);
		expect(getActiveSub()).toBe(inner);

		setActiveSub(outer);
		expect(getActiveSub()).toBe(outer);

		setActiveSub(undefined);
		expect(getActiveSub()).toBeUndefined();
	});
});
