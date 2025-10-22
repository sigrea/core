import { afterEach, describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { defineLogic } from "../defineLogic";
import { cleanupLogic, cleanupLogics, mountLogic } from "../testing";

afterEach(() => {
	cleanupLogics();
});

describe("logic testing utilities", () => {
	it("cleanupLogic tears down a mounted instance once", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		const instance = mountLogic(Logic);

		cleanupLogic(instance);
		cleanupLogic(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("cleanupLogics clears every tracked instance", () => {
		const cleanup = vi.fn();

		const Logic = defineLogic()(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		mountLogic(Logic);
		mountLogic(Logic);

		cleanupLogics();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});
});
