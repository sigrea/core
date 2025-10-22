import { describe, expect, it } from "vitest";

import { readonly } from "../readonly";
import { signal } from "../signal";

describe("readonly", () => {
	it("reflects source updates without exposing setter", () => {
		const count = signal(1);
		const view = readonly(count);

		expect(view.value).toBe(1);

		count.value = 3;
		expect(view.value).toBe(3);
	});

	it("throws when attempting to assign to value", () => {
		const count = signal(0);
		const view = readonly(count);

		expect(() => {
			// @ts-expect-error runtime guard
			view.value = 1;
		}).toThrow(TypeError);
	});
});
