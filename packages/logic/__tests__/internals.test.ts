import { describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { defineLogic } from "../defineLogic";
import { isLogicInstance } from "../instance";
import { disposeLogic } from "../internals";
import { mountLogic } from "../testing";

describe("logic internals", () => {
	it("identifies logic instances", () => {
		const Logic = defineLogic()(() => ({}));
		const instance = mountLogic(Logic);

		expect(isLogicInstance(instance)).toBe(true);
		expect(isLogicInstance({})).toBe(false);

		disposeLogic(instance);

		expect(isLogicInstance(instance)).toBe(false);
	});

	it("disposes logic and triggers registered cleanups", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		const instance = mountLogic(Logic);

		disposeLogic(instance);
		disposeLogic(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});
});
