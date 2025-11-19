import { afterEach, describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { defineLogic } from "../defineLogic";
import { cleanupLogic, cleanupLogics, mountLogic } from "../testing";

afterEach(() => {
	cleanupLogics();
});

describe("logic testing utilities", () => {
	const suppressConsoleError = () =>
		vi.spyOn(console, "error").mockImplementation(() => {});

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

	it("aggregates errors when cleanupLogics encounters failures", () => {
		const errorSpy = suppressConsoleError();
		try {
			const cleanup = vi.fn(() => {
				throw new Error("cleanup failure");
			});

			const Logic = defineLogic()(() => {
				onUnmount(() => {
					cleanup();
					throw new Error("teardown failure");
				});
				return {};
			});

			mountLogic(Logic);
			mountLogic(Logic);

			let caught: unknown;
			try {
				cleanupLogics();
			} catch (error) {
				caught = error;
			}

			expect(cleanup).toHaveBeenCalledTimes(2);
			expect(caught).toBeInstanceOf(AggregateError);
			const aggregate = caught as AggregateError;
			expect(aggregate.errors).toHaveLength(2);
			expect(errorSpy).toHaveBeenCalledTimes(2);
		} finally {
			errorSpy.mockRestore();
		}
	});
});
