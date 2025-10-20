import { describe, expect, it } from "vitest";

import { effect } from ".";
import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { signal } from "../signal";

describe("effect", () => {
	it("runs immediately and reacts to signal changes", () => {
		const count = signal(0);
		let runs = 0;

		const stop = effect(() => {
			runs += 1;
			count.value;
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		stop();

		count.value = 2;
		expect(runs).toBe(2);
	});

	it("stops automatically when scope is unmounted", () => {
		const count = signal(0);
		let runs = 0;

		const scope = onMount(() => {
			effect(() => {
				runs += 1;
				count.value;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		onUnmount(scope);

		count.value = 2;
		expect(runs).toBe(2);
	});
});
