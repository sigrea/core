import { describe, expect, it } from "vitest";

import {
	disposeMolecule,
	mountMolecule,
	unmountMolecule,
} from "../../internals";
import { molecule } from "../../molecule";
import { onMount } from "../onMount";
import { onUnmount } from "../onUnmount";

describe("onUnmount", () => {
	it("registers cleanup that runs when molecule unmounts", () => {
		const events: string[] = [];

		const DemoMolecule = molecule(() => {
			onUnmount(() => {
				events.push("unmount");
			});
			return {};
		});

		const instance = DemoMolecule();
		expect(events).toEqual([]);

		mountMolecule(instance);
		expect(events).toEqual([]);

		unmountMolecule(instance);
		expect(events).toEqual(["unmount"]);

		disposeMolecule(instance);
		expect(events).toEqual(["unmount"]);
	});

	it("can be registered inside onMount callbacks", () => {
		const events: string[] = [];

		const DemoMolecule = molecule(() => {
			onMount(() => {
				onUnmount(() => {
					events.push("cleanup");
				});
			});
			return {};
		});

		const instance = DemoMolecule();
		mountMolecule(instance);
		expect(events).toEqual([]);

		unmountMolecule(instance);
		expect(events).toEqual(["cleanup"]);
	});
});
