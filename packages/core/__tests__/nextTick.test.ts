import { describe, expect, it } from "vitest";

import { nextTick } from "../nextTick";
import { signal } from "../signal";
import { watch } from "../watch";

describe("nextTick", () => {
	it("defers callbacks to the microtask queue", async () => {
		let called = false;
		const promise = nextTick(() => {
			called = true;
		});

		expect(called).toBe(false);

		await promise;

		expect(called).toBe(true);
	});

	it("returns a promise when no callback is provided", async () => {
		let ticked = false;
		const promise = nextTick().then(() => {
			ticked = true;
		});

		await promise;

		expect(ticked).toBe(true);
	});

	it("waits for post-flush watchers before resolving", async () => {
		const count = signal(0);
		const calls: string[] = [];
		const stop = watch(
			count,
			() => {
				calls.push("post");
			},
			{ flush: "post" },
		);

		count.value = 1;
		expect(calls).toEqual([]);

		await nextTick();
		expect(calls).toEqual(["post"]);

		stop();
	});
});
