import { describe, expect, it } from "vitest";

import {
	disposeMolecule,
	mountMolecule,
	unmountMolecule,
} from "../../internals";
import { molecule } from "../../molecule";
import { onMount } from "../onMount";

describe("onMount", () => {
	it("runs callback on mount and runs returned cleanup on unmount", () => {
		const events: string[] = [];

		const DemoMolecule = molecule(() => {
			onMount(() => {
				events.push("mount");
				return () => {
					events.push("cleanup");
				};
			});
			return {};
		});

		const instance = DemoMolecule();

		expect(events).toEqual([]);

		mountMolecule(instance);
		expect(events).toEqual(["mount"]);

		unmountMolecule(instance);
		expect(events).toEqual(["mount", "cleanup"]);

		disposeMolecule(instance);
		expect(events).toEqual(["mount", "cleanup"]);
	});

	it("throws when called outside molecule setup", () => {
		expect(() => onMount(() => {})).toThrow(
			"onMount(...) can only be called synchronously during molecule setup.",
		);
	});
});
