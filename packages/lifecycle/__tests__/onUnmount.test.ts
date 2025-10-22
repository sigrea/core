import { describe, expect, it } from "vitest";

import { onMount } from "../onMount";
import { onUnmount } from "../onUnmount";

describe("onUnmount", () => {
	it("registers cleanup within active scope", () => {
		const events: string[] = [];

		const scope = onMount(() => {
			onUnmount(() => {
				events.push("cleanup");
			});
		});

		expect(events).toHaveLength(0);

		onUnmount(scope);

		expect(events).toEqual(["cleanup"]);
	});

	it("executes callback immediately when no scope is active", () => {
		const events: string[] = [];

		onUnmount(() => {
			events.push("immediate");
		});

		expect(events).toEqual(["immediate"]);
	});
});
