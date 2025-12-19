import { afterEach, describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { disposeMolecule } from "../internals";
import { molecule } from "../molecule";
import { disposeTrackedMolecules, trackMolecule } from "../testing";
import type { MoleculeInstance } from "../types";

afterEach(() => {
	disposeTrackedMolecules();
});

describe("molecule testing utilities", () => {
	const suppressConsoleError = () =>
		vi.spyOn(console, "error").mockImplementation(() => {});

	it("trackMolecule adds instance to tracked set", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		const instance = DemoMolecule();
		trackMolecule(instance);
		disposeTrackedMolecules();

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("trackMolecule ignores non-molecule instances", () => {
		expect(() =>
			trackMolecule({} as unknown as MoleculeInstance<object>),
		).not.toThrow();
	});

	it("disposeMolecule tears down a molecule instance once", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		const instance = DemoMolecule();

		disposeMolecule(instance);
		disposeMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("disposeTrackedMolecules clears every tracked instance", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				cleanup();
			});
			return {};
		});

		trackMolecule(DemoMolecule());
		trackMolecule(DemoMolecule());

		disposeTrackedMolecules();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it("aggregates errors when disposeTrackedMolecules encounters failures", () => {
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

			trackMolecule(DemoMolecule());
			trackMolecule(DemoMolecule());

			let caught: unknown;
			try {
				disposeTrackedMolecules();
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
