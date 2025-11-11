import { describe, expect, it } from "vitest";

import { nextTick } from "../nextTick";

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
});
