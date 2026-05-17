import { describe, expect, it } from "vitest";

import { computed } from "../computed";
import { effect } from "../reactivity";
import { signal } from "../signal";
import { watchEffect } from "../watchEffect";

describe("reactivity runtime", () => {
	it("continues propagation after inner writes through a computed chain", () => {
		const source = signal(0);
		const first = computed(() => source.value);
		const second = computed(() => first.value);
		let runs = 0;

		const stop = watchEffect(
			() => {
				runs += 1;
				if (second.value > 0) {
					source.value = 0;
				}
			},
			{ flush: "sync" },
		);

		expect(runs).toBe(1);

		source.value = 1;
		expect(source.value).toBe(0);
		expect(runs).toBe(2);

		source.value = 2;
		expect(source.value).toBe(0);
		expect(runs).toBe(3);

		source.value = 3;
		expect(source.value).toBe(0);
		expect(runs).toBe(4);

		stop();
	});

	it("does not throw when a computed update disposes its subscriber", () => {
		const shouldDispose = signal(false);
		const subscriber = {
			current: undefined as ReturnType<typeof effect> | undefined,
		};

		const indirectlyDisposes = computed(() => {
			if (shouldDispose.value) {
				subscriber.current?.stop();
			}
			return 0;
		});

		const selfDisposing = computed(() => {
			indirectlyDisposes.value;
			return 0;
		});

		subscriber.current = effect(() => {
			selfDisposing.value;
		});

		expect(() => {
			shouldDispose.value = true;
		}).not.toThrow();

		subscriber.current.stop();
	});
});
