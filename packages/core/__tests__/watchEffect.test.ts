import { describe, expect, it } from "vitest";

import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import type { Cleanup } from "../scope";
import { createScope, disposeScope, onDispose, runWithScope } from "../scope";
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

	it("tears down automatically when enclosing scope is disposed", async () => {
		const count = signal(0);
		let runs = 0;

		const scope = createScope();
		runWithScope(scope, () => {
			watchEffect(() => {
				runs += 1;
				count.value;
			});

			onDispose(() => {
				runs += 100;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		await nextTick();
		expect(runs).toBe(2);

		disposeScope(scope);
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

	it("does not run while paused and runs cleanup once before resuming", async () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watchEffect((onCleanup) => {
			const value = count.value;
			events.push(`run-${value}`);
			onCleanup(() => {
				events.push(`cleanup-${value}`);
			});
		});

		expect(events).toEqual(["run-0"]);

		handle.pause();
		count.value = 1;
		count.value = 2;
		await nextTick();

		expect(events).toEqual(["run-0"]);

		handle.resume();
		await nextTick();

		expect(events).toEqual(["run-0", "cleanup-0", "run-2"]);

		handle.stop();
	});

	it("runs cleanup when stopped while paused", async () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watchEffect((onCleanup) => {
			const value = count.value;
			events.push(`run-${value}`);
			onCleanup(() => {
				events.push(`cleanup-${value}`);
			});
		});

		expect(events).toEqual(["run-0"]);

		handle.pause();
		count.value = 1;
		await nextTick();
		expect(events).toEqual(["run-0"]);

		handle.stop();
		expect(events).toEqual(["run-0", "cleanup-0"]);

		handle.resume();
		count.value = 2;
		await nextTick();
		expect(events).toEqual(["run-0", "cleanup-0"]);
	});

	it("defers sync resume requested by cleanup until the effect rerun finishes", () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watchEffect(
			(onCleanup) => {
				const value = count.value;
				events.push(`run-${value}`);
				onCleanup(() => {
					events.push(`cleanup-${value}`);
					if (value === 0) {
						handle.pause();
						count.value = 2;
						handle.resume();
						events.push(`after-resume-${count.value}`);
					}
				});
			},
			{ flush: "sync" },
		);

		count.value = 1;

		expect(events).toEqual(["run-0", "cleanup-0", "after-resume-2", "run-2"]);

		handle.stop();
	});

	it("defers sync resume requested while the effect is running", () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watchEffect(
			() => {
				const value = count.value;
				events.push(`run-${value}`);
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
					events.push("after-resume");
				}
			},
			{ flush: "sync" },
		);

		count.value = 1;

		expect(events).toEqual(["run-0", "run-1", "after-resume", "run-2"]);

		handle.stop();
	});

	it("reports both errors when a sync resumed effect and rerun throw", () => {
		const count = signal(0);
		const events: string[] = [];
		const errors: unknown[] = [];

		const handle = watchEffect(
			() => {
				const value = count.value;
				events.push(`run-${value}`);
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
					throw new Error("first");
				}
				if (value === 2) {
					throw new Error("second");
				}
			},
			{ flush: "sync" },
		);

		try {
			count.value = 1;
		} catch (error) {
			errors.push(error);
		}

		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(AggregateError);
		expect((errors[0] as AggregateError).errors).toEqual([
			expect.objectContaining({ message: "first" }),
			expect.objectContaining({ message: "second" }),
		]);
		expect(events).toEqual(["run-0", "run-1", "run-2"]);

		handle.stop();
	});

	it("can return a cleanup from an async effect", async () => {
		const count = signal(0);
		const events: string[] = [];

		const stop = watchEffect(async () => {
			events.push(`run-${count.value}`);
			await Promise.resolve();
			return () => {
				events.push("cleanup");
			};
		});

		await Promise.resolve();
		expect(events).toEqual(["run-0"]);

		count.value = 1;
		await nextTick();
		await Promise.resolve();
		expect(events).toEqual(["run-0", "cleanup", "run-1"]);

		stop();
	});

	it("runs async cleanup even if the effect is invalidated before it resolves", async () => {
		const count = signal(0);
		const events: string[] = [];
		const pending: Array<() => void> = [];

		const stop = watchEffect(() => {
			const runId = count.value;
			events.push(`run-${runId}`);
			return new Promise<Cleanup>((resolve) => {
				pending.push(() => {
					resolve(() => {
						events.push(`cleanup-${runId}`);
					});
				});
			});
		});

		await Promise.resolve();
		expect(events).toEqual(["run-0"]);

		count.value = 1;
		await nextTick();
		expect(events).toEqual(["run-0", "run-1"]);

		pending.shift()?.();
		await Promise.resolve();
		expect(events).toEqual(["run-0", "run-1", "cleanup-0"]);

		stop();
	});
});
