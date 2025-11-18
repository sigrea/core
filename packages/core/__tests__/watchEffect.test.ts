import { describe, expect, it } from "vitest";

import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import { signal } from "../signal";
import { watchEffect } from "../watchEffect";

describe("watchEffect", () => {
	it("runs effect reactively until stopped", async () => {
		const count = signal(0);
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			// access reactive dependency
			count.value;
		});

		expect(runs).toBe(1);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		stop();
		count.value = 2;
		await nextTick();
		expect(runs).toBe(2);
	});

	it("tears down automatically when enclosing scope unmounts", async () => {
		const count = signal(0);
		let runs = 0;

		const scope = onMount(() => {
			watchEffect(() => {
				runs += 1;
				count.value;
			});

			onUnmount(() => {
				runs += 100;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		onUnmount(scope);
		expect(runs).toBe(102);

		count.value = 2;
		await nextTick();
		expect(runs).toBe(102);
	});

	it("does not self-track when writing to accessor properties", () => {
		let backing = 0;
		const state = deepSignal({
			get count() {
				return backing;
			},
			set count(value: number) {
				backing = value;
			},
		});
		let runs = 0;

		const stop = watchEffect(() => {
			runs += 1;
			state.count = runs;
		});

		expect(runs).toBe(1);

		stop();
	});

	it("respects flush options", async () => {
		const count = signal(0);
		const calls: string[] = [];

		const stopPre = watchEffect(
			() => {
				// consume dependency to stay reactive
				count.value;
				calls.push("pre");
			},
			{ flush: "pre" },
		);

		const stopPost = watchEffect(
			() => {
				count.value;
				calls.push("post");
			},
			{ flush: "post" },
		);

		calls.length = 0;
		count.value = 1;

		await nextTick();
		expect(calls).toEqual(["pre", "post"]);

		stopPre();
		stopPost();
	});
});
