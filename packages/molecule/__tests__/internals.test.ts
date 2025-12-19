import { describe, expect, it, vi } from "vitest";

import { onUnmount } from "../../lifecycle/onUnmount";
import { isMoleculeInstance } from "../instance";
import { disposeMolecule } from "../internals";
import { molecule } from "../molecule";

describe("molecule internals", () => {
	it("identifies molecule instances", () => {
		const DemoMolecule = molecule(() => ({}));
		const instance = DemoMolecule();

		expect(isMoleculeInstance(instance)).toBe(true);
		expect(isMoleculeInstance({})).toBe(false);

		disposeMolecule(instance);

		expect(isMoleculeInstance(instance)).toBe(false);
	});

	it("disposes molecule and triggers registered cleanups", () => {
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
});
