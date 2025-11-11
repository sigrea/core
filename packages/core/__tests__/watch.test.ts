import { describe, expect, it } from "vitest";

import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import { TrackOpType, TriggerOpType } from "../reactivity";
import { signal } from "../signal";
import { watch } from "../watch";

const waitForMacroTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("watch", () => {
	it("invokes callback when source changes", () => {
		const count = signal(0);
		const seen: Array<[number | undefined, number | undefined]> = [];

		const stop = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
			},
			{ immediate: true },
		);

		count.value = 1;
		count.value = 2;

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[2, 1],
		]);

		stop();
	});

	it("supports once option", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watch(
			count,
			() => {
				runs += 1;
			},
			{ once: true },
		);

		count.value = 1;
		count.value = 2;

		expect(runs).toBe(1);

		stop();
	});

	it("tracks deep paths when requested", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			() => state.nested,
			() => {
				runs += 1;
			},
			{ deep: true, immediate: true },
		);

		state.nested.flag = true;

		expect(runs).toBe(2);

		stop();
	});

	it("tracks deep signals returned from object sources when deep is true", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			() => ({ nested: state.nested }),
			() => {
				runs += 1;
			},
			{ deep: true },
		);

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("does not react to nested deep signal changes when deep is false", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.nested.flag = true;

		expect(runs).toBe(0);

		stop();
	});

	it("does not react to nested deep signal entries in source arrays when deep is false", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			[state],
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.nested.flag = true;

		expect(runs).toBe(0);

		stop();
	});

	it("reacts to nested deep signal changes by default", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to top-level deep signal changes by default", () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.count = 1;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to top-level deep signal changes even when deep is false", () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: false },
		);

		state.count = 1;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to nested deep signal changes when using a finite depth", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(
			state,
			() => {
				runs += 1;
			},
			{ deep: 1 },
		);

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to deep changes in map keys when deep is true", () => {
		const key = deepSignal({ flag: false });
		const map = deepSignal(new Map([[key, 1]]));
		let runs = 0;

		const stop = watch(
			map,
			() => {
				runs += 1;
			},
			{ deep: true },
		);

		key.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("does not trigger callbacks when unrelated sources perform no-op writes", () => {
		const count = signal(0);
		const state = deepSignal({ flag: false });
		let runs = 0;

		const stop = watch([count, state], () => {
			runs += 1;
		});

		count.value = 0;
		expect(runs).toBe(0);

		state.flag = true;
		expect(runs).toBe(1);

		stop();
	});

	it("does not force multi-source watchers when derived values stay the same", () => {
		const count = signal(0);
		const seen: number[] = [];

		const stop = watch(
			[() => count.value % 2],
			([value]) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		count.value = 2;
		count.value = 3;

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("updates array length signals when adding elements via index assignment", () => {
		const state = deepSignal({ items: [] as number[] });
		const lengths: number[] = [];

		const stop = watch(
			() => state.items.length,
			(value) => {
				lengths.push(value);
			},
			{ immediate: true },
		);

		state.items[state.items.length] = 42;

		expect(lengths).toEqual([0, 1]);

		stop();
	});

	it("cleans up automatically when scope is unmounted", () => {
		const count = signal(0);
		let runs = 0;

		const scope = onMount(() => {
			watch(
				count,
				() => {
					runs += 1;
				},
				{ immediate: true },
			);

			onUnmount(() => {
				runs += 100;
			});
		});

		expect(runs).toBe(1);

		count.value = 1;
		expect(runs).toBe(2);

		onUnmount(scope);
		expect(runs).toBe(102);

		count.value = 2;
		expect(runs).toBe(102);
	});

	it("allows the stop handle to be called multiple times safely", () => {
		const count = signal(0);
		let runs = 0;

		const stop = watch(
			count,
			() => {
				runs += 1;
			},
			{ immediate: true },
		);

		expect(runs).toBe(1);

		stop();
		expect(() => stop()).not.toThrow();

		count.value = 1;
		expect(runs).toBe(1);
	});

	it("accepts arrays containing deep signals", () => {
		const state = deepSignal({ count: 0 });
		const counts: number[] = [];

		const stop = watch(
			[state],
			([value]) => {
				counts.push(value.count);
			},
			{ immediate: true },
		);

		state.count = 1;
		state.count = 2;

		expect(counts).toEqual([0, 1, 2]);

		stop();
	});

	it("reacts to top-level changes in deep signal array sources when deep is false", () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(
			[state],
			([value]) => {
				runs += 1;
				expect(value.count).toBe(state.count);
			},
			{ deep: false, immediate: true },
		);

		state.count = 1;

		expect(runs).toBe(2);

		stop();
	});

	it("reacts to nested deep signal changes when watching via array sources", () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch([state], () => {
			runs += 1;
		});

		state.nested.flag = true;

		expect(runs).toBe(1);

		stop();
	});

	it("treats infinite deep option as deep watcher", () => {
		const state = deepSignal({ nested: { flag: false } });
		const flags: Array<boolean | undefined> = [];

		const stop = watch(
			() => state.nested,
			() => {
				flags.push(state.nested.flag);
			},
			{ deep: Number.POSITIVE_INFINITY, immediate: true },
		);

		state.nested.flag = true;

		expect(flags).toEqual([false, true]);

		stop();
	});

	it("does not force primitive watchers when deep option is numeric", () => {
		const count = signal(0);
		const seen: number[] = [];

		const stop = watch(
			count,
			(value) => {
				seen.push(value);
			},
			{ deep: 0, immediate: true },
		);

		count.value = 0;
		count.value = 1;

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("notifies watchers when assigning to accessor properties", () => {
		let backing = 0;
		const state = deepSignal({
			get count() {
				return backing;
			},
			set count(value: number) {
				backing = value;
			},
		});
		const seen: number[] = [];

		const stop = watch(
			() => state.count,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		state.count = 1;
		state.count = 1;
		state.count = 2;

		expect(seen).toEqual([0, 1, 2]);

		stop();
	});

	it("runs sync-flush watchers immediately", async () => {
		const count = signal(0);
		const calls: string[] = [];

		const stopSync = watch(
			count,
			() => {
				calls.push("sync");
			},
			{ flush: "sync" },
		);

		const stopPre = watch(
			count,
			() => {
				calls.push("pre");
			},
			{ flush: "pre" },
		);

		count.value = 1;

		expect(calls).toEqual(["sync"]);

		await nextTick();

		expect(calls).toEqual(["sync", "pre"]);

		stopSync();
		stopPre();
	});

	it("queues post-flush watchers after other jobs", async () => {
		const count = signal(0);
		const calls: string[] = [];

		const stopPre = watch(
			count,
			() => {
				calls.push("pre");
			},
			{ flush: "pre" },
		);

		const stopPost = watch(
			count,
			() => {
				calls.push("post");
			},
			{ flush: "post" },
		);

		count.value = 1;
		expect(calls).toEqual([]);

		await nextTick();
		expect(calls).toEqual(["pre"]);

		await waitForMacroTask();

		expect(calls).toEqual(["pre", "post"]);

		stopPre();
		stopPost();
	});

	it("invokes onTrack and onTrigger hooks", () => {
		const state = deepSignal({ count: 0 });
		const tracked: Array<{ type: TrackOpType; key: unknown }> = [];
		const triggered: Array<{ type: TriggerOpType; key: unknown }> = [];

		const stop = watch(
			() => state.count,
			() => {},
			{
				onTrack: (event) => {
					tracked.push({
						type: event.type as TrackOpType,
						key: event.key,
					});
				},
				onTrigger: (event) => {
					triggered.push({
						type: event.type as TriggerOpType,
						key: event.key,
					});
				},
			},
		);

		state.count = 1;

		expect(
			tracked.some(
				(entry) => entry.type === TrackOpType.GET && entry.key === "count",
			),
		).toBe(true);
		expect(
			triggered.some(
				(entry) => entry.type === TriggerOpType.SET && entry.key === "count",
			),
		).toBe(true);

		stop();
	});

	it("recovers pre-flush queue after exceptions", async () => {
		const count = signal(0);
		const results: string[] = [];
		const errors: Error[] = [];

		const stopThrowing = watch(
			count,
			() => {
				throw new Error("pre boom");
			},
			{ flush: "pre" },
		);

		const stopWatcher = watch(
			count,
			() => {
				results.push("ok");
			},
			{ flush: "pre" },
		);

		const waitForException = () =>
			new Promise<void>((resolve) => {
				process.once("uncaughtException", (error) => {
					errors.push(error as Error);
					resolve();
				});
			});

		const exceptionPromise = waitForException();
		count.value = 1;
		await exceptionPromise;

		await nextTick();
		await waitForMacroTask();

		stopThrowing();
		stopWatcher();

		expect(errors.length).toBeGreaterThan(0);
		expect(results).toEqual(["ok"]);
	});

	it("recovers post-flush queue after exceptions", async () => {
		const count = signal(0);
		const results: string[] = [];
		const errors: Error[] = [];

		const stopThrowing = watch(
			count,
			() => {
				throw new Error("post boom");
			},
			{ flush: "post" },
		);

		const stopWatcher = watch(
			count,
			() => {
				results.push("ok");
			},
			{ flush: "post" },
		);

		const waitForException = () =>
			new Promise<void>((resolve) => {
				process.once("uncaughtException", (error) => {
					errors.push(error as Error);
					resolve();
				});
			});

		const exceptionPromise = waitForException();
		count.value = 1;
		await exceptionPromise;

		await nextTick();
		await waitForMacroTask();

		stopThrowing();
		stopWatcher();

		expect(errors.length).toBeGreaterThan(0);
		expect(results).toEqual(["ok"]);
	});
});
