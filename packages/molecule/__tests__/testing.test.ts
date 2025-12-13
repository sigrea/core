import { afterEach, describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { molecule } from "../molecule";
import { cleanupMolecule, cleanupMolecules, mountMolecule } from "../testing";

afterEach(() => {
	cleanupMolecules();
});

describe("molecule testing utilities", () => {
	const suppressConsoleError = () =>
		vi.spyOn(console, "error").mockImplementation(() => {});

	it("cleanupMolecule tears down a mounted instance once", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		const instance = mountMolecule(DemoMolecule);

		cleanupMolecule(instance);
		cleanupMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("cleanupMolecules clears every tracked instance", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		mountMolecule(DemoMolecule);
		mountMolecule(DemoMolecule);

		cleanupMolecules();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it("aggregates errors when cleanupMolecules encounters failures", () => {
		const errorSpy = suppressConsoleError();
		try {
			const cleanup = vi.fn(() => {
				throw new Error("cleanup failure");
			});

			const DemoMolecule = molecule(() => {
				onUnmount(() => {
					cleanup();
					throw new Error("teardown failure");
				});
				return {};
			});

			mountMolecule(DemoMolecule);
			mountMolecule(DemoMolecule);

			let caught: unknown;
			try {
				cleanupMolecules();
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
