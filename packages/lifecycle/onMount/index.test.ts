import { describe, expect, it } from "vitest";

import { onMount } from ".";
import { onUnmount } from "../onUnmount";

describe("onMount", () => {
	it("runs callback and returns scope handle", () => {
		let mounted = false;
		let cleaned = false;

		const scope = onMount(() => {
			mounted = true;
			return () => {
				cleaned = true;
			};
		});

		expect(mounted).toBe(true);
		expect(cleaned).toBe(false);

		onUnmount(scope);
		expect(cleaned).toBe(true);
	});

	it("disposes child scopes when parent unmounts", () => {
		const events: string[] = [];

		const parent = onMount(() => {
			events.push("parent-mount");
		});

		onMount(
			() => {
				events.push("child-mount");
				return () => {
					events.push("child-cleanup");
				};
			},
			{ parent },
		);

		expect(events).toEqual(["parent-mount", "child-mount"]);

		onUnmount(parent);

		expect(events).toEqual(["parent-mount", "child-mount", "child-cleanup"]);
	});
});
