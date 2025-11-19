import { describe, expect, it } from "vitest";

import { onMount } from "../../lifecycle/onMount";
import { onUnmount } from "../../lifecycle/onUnmount";
import { computed } from "../computed";
import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import { TrackOpType, TriggerOpType } from "../reactivity";
import { readonly } from "../readonly";
import type { Cleanup } from "../scope";
import { signal } from "../signal";
import { watch } from "../watch";

const waitForMacroTask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("watch", () => {
	it("invokes callback when source changes", async () => {
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
		await nextTick();
		count.value = 2;
		await nextTick();

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[2, 1],
		]);

		stop();
	});

	it("defers callbacks to the microtask queue by default", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const stop = watch(count, (value) => {
			seen.push(value);
		});

		count.value = 1;
		expect(seen).toEqual([]);

		await nextTick();

		expect(seen).toEqual([1]);

		stop();
	});

	it("tracks deep paths when requested", async () => {
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
		await nextTick();

		expect(runs).toBe(2);

		stop();
	});

	it("tracks deep signals returned from object sources when deep is true", async () => {
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
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("does not react to nested deep signal changes when deep is false", async () => {
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
		await nextTick();

		expect(runs).toBe(0);

		stop();
	});

	it("does not react to nested deep signal entries in source arrays when deep is false", async () => {
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
		await nextTick();

		expect(runs).toBe(0);

		stop();
	});

	it("reacts to nested deep signal changes by default", async () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.nested.flag = true;
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("does not react to nested deep signal changes when deep is false", async () => {
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
		await nextTick();
		expect(runs).toBe(0);

		state.nested = { flag: true };
		await nextTick();
		expect(runs).toBe(1);

		stop();
	});

	it("reacts to top-level deep signal changes by default", async () => {
		const state = deepSignal({ count: 0 });
		let runs = 0;

		const stop = watch(state, () => {
			runs += 1;
		});

		state.count = 1;
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to top-level deep signal changes even when deep is false", async () => {
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
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to nested deep signal changes when using a finite depth", async () => {
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
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("reacts to deep changes in map keys when deep is true", async () => {
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
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("does not trigger callbacks when unrelated sources perform no-op writes", async () => {
		const count = signal(0);
		const state = deepSignal({ flag: false });
		let runs = 0;

		const stop = watch([count, state], () => {
			runs += 1;
		});

		count.value = 0;
		await nextTick();
		expect(runs).toBe(0);

		state.flag = true;
		await nextTick();
		expect(runs).toBe(1);

		stop();
	});

	it("does not force multi-source watchers when derived values stay the same", async () => {
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
		await nextTick();
		count.value = 3;
		await nextTick();

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("accepts cleanup returned directly from the callback", async () => {
		const count = signal(0);
		const events: string[] = [];

		const stop = watch(
			count,
			() => {
				events.push("run");
				return () => {
					events.push("cleanup");
				};
			},
			{ immediate: true },
		);

		expect(events).toEqual(["run"]);

		count.value = 1;
		await nextTick();
		expect(events).toEqual(["run", "cleanup", "run"]);

		stop();
	});

	it("registers cleanup resolved from a promise returned by the callback", async () => {
		const count = signal(0);
		const events: string[] = [];

		const stop = watch(
			count,
			async () => {
				events.push("run");
				await Promise.resolve();
				return () => {
					events.push("cleanup");
				};
			},
			{ immediate: true },
		);

		await Promise.resolve();
		expect(events).toEqual(["run"]);

		count.value = 1;
		await nextTick();
		await Promise.resolve();
		expect(events).toEqual(["run", "cleanup", "run"]);

		stop();
	});

	it("runs async cleanup even if the promise resolves after invalidation", async () => {
		const count = signal(0);
		const events: string[] = [];
		const pending: Array<() => void> = [];

		const stop = watch(
			count,
			() => {
				const runId = count.value;
				events.push(`run-${runId}`);
				return new Promise<Cleanup>((resolve) => {
					pending.push(() => {
						resolve(() => {
							events.push(`cleanup-${runId}`);
						});
					});
				});
			},
			{ immediate: true },
		);

		await nextTick();
		expect(events).toEqual(["run-0"]);

		count.value = 1;
		await nextTick();
		expect(events).toEqual(["run-0", "run-1"]);

		pending.shift()?.();
		await Promise.resolve();
		expect(events).toEqual(["run-0", "run-1", "cleanup-0"]);

		stop();
	});

	it("runs async cleanup even if the watcher is stopped before it resolves", async () => {
		const count = signal(0);
		const events: string[] = [];
		let resolveCleanup: (() => void) | undefined;

		const stop = watch(
			count,
			() => {
				events.push("run");
				return new Promise<Cleanup>((resolve) => {
					resolveCleanup = () => {
						resolve(() => {
							events.push("cleanup");
						});
					};
				});
			},
			{ immediate: true },
		);

		await nextTick();
		expect(events).toEqual(["run"]);

		stop();
		expect(events).toEqual(["run"]);

		resolveCleanup?.();
		await Promise.resolve();
		expect(events).toEqual(["run", "cleanup"]);
	});

	it("updates array length signals when adding elements via index assignment", async () => {
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
		await nextTick();

		expect(lengths).toEqual([0, 1]);

		stop();
	});

	it("cleans up automatically when scope is unmounted", async () => {
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
		await nextTick();
		expect(runs).toBe(2);

		onUnmount(scope);
		expect(runs).toBe(102);

		count.value = 2;
		await nextTick();
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

	it("accepts arrays containing deep signals", async () => {
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
		await nextTick();
		state.count = 2;
		await nextTick();

		expect(counts).toEqual([0, 1, 2]);

		stop();
	});

	it("reacts to top-level changes in deep signal array sources when deep is false", async () => {
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
		await nextTick();

		expect(runs).toBe(2);

		stop();
	});

	it("reacts to nested deep signal changes when watching via array sources", async () => {
		const state = deepSignal({ nested: { flag: false } });
		let runs = 0;

		const stop = watch([state], () => {
			runs += 1;
		});

		state.nested.flag = true;
		await nextTick();

		expect(runs).toBe(1);

		stop();
	});

	it("watches readonly deep signal sources", async () => {
		const source = deepSignal({ nested: { count: 0 } });
		const state = readonly(source);
		const seen: number[] = [];

		const stop = watch(
			state,
			() => {
				seen.push(state.nested.count);
			},
			{ immediate: true },
		);

		source.nested.count += 1;
		await nextTick();

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("treats infinite deep option as deep watcher", async () => {
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
		await nextTick();

		expect(flags).toEqual([false, true]);

		stop();
	});

	it("does not force primitive watchers when deep option is numeric", async () => {
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
		await nextTick();
		count.value = 1;
		await nextTick();

		expect(seen).toEqual([0, 1]);

		stop();
	});

	it("notifies watchers when assigning to accessor properties", async () => {
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
		await nextTick();
		state.count = 1;
		await nextTick();
		state.count = 2;
		await nextTick();

		expect(seen).toEqual([0, 1, 2]);

		stop();
	});

	it("stabilizes recursive sync watchers on computed sources", async () => {
		const base = signal(0);
		const mirrored = computed(() => base.value);

		const stop = watch(
			mirrored,
			(value) => {
				if (value > 1) {
					base.value -= 1;
				}
			},
			{ flush: "sync" },
		);

		expect(base.value).toBe(0);
		expect(mirrored.value).toBe(0);

		base.value = 10;
		await nextTick();

		expect(base.value).toBe(1);
		expect(mirrored.value).toBe(1);

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
		expect(calls).toEqual(["pre", "post"]);

		stopPre();
		stopPost();
	});

	it("invokes onTrack and onTrigger hooks", async () => {
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
		await nextTick();

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

	it("runs watchers in batch order", async () => {
		const order: number[] = [];
		const first = signal(0);
		const second = signal(0);
		const total = computed(() => first.value + second.value);

		const stopFirst = watch(first, () => {
			order.push(1);
			second.value += 1;
		});
		const stopTotal = watch(total, () => {
			order.push(2);
		});
		const stopLast = watch(first, () => {
			order.push(3);
		});

		first.value += 1;
		await nextTick();

		expect(order).toEqual([1, 2, 3]);

		stopFirst();
		stopTotal();
		stopLast();
	});

	it("resets values synchronously when using sync flush", () => {
		const flag = signal(false);

		const stop = watch(
			flag,
			() => {
				flag.value = false;
			},
			{ flush: "sync" },
		);

		flag.value = true;
		flag.value = true;

		expect(flag.value).toBe(false);

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
