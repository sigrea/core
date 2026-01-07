import { describe, expect, it, vi } from "vitest";

import { onDispose } from "../../core/scope";
import { isMoleculeInstance } from "../instance";
import {
	disposeMolecule,
	getMoleculeMetadata,
	mountMolecule,
	unmountMolecule,
} from "../internals";
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
			onDispose(() => {
				cleanup();
			});
			return {};
		});

		const instance = DemoMolecule();

		disposeMolecule(instance);
		disposeMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("does not accumulate mount cleanups on the setup scope", () => {
		const DemoMolecule = molecule(() => ({}));
		const instance = DemoMolecule();

		const metadata = getMoleculeMetadata(instance);
		expect(metadata).toBeDefined();

		const getCleanupCount = () =>
			(metadata as unknown as { scope: { cleanups: Set<unknown> } }).scope
				.cleanups.size;

		expect(getCleanupCount()).toBe(0);

		mountMolecule(instance);
		unmountMolecule(instance);
		mountMolecule(instance);
		unmountMolecule(instance);

		expect(getCleanupCount()).toBe(0);

		disposeMolecule(instance);
	});
});
