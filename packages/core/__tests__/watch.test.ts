import { describe, expect, it } from "vitest";

import { computed } from "../computed";
import { deepSignal } from "../deepSignal";
import { nextTick } from "../nextTick";
import { TrackOpType, TriggerOpType } from "../reactivity";
import { readonly } from "../readonly";
import type { Cleanup } from "../scope";
import { createScope, disposeScope, onDispose, runWithScope } from "../scope";
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

	it("cleans up automatically when scope is disposed", async () => {
		const count = signal(0);
		let runs = 0;

		const scope = createScope();
		runWithScope(scope, () => {
			watch(
				count,
				() => {
					runs += 1;
				},
				{ immediate: true },
			);

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

	it("stops through the stop method and callable handle", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const handle = watch(
			count,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		expect(seen).toEqual([0]);

		handle.pause();
		count.value = 1;
		await nextTick();
		expect(seen).toEqual([0]);

		handle.stop();
		handle.resume();

		count.value = 2;
		await nextTick();
		expect(seen).toEqual([0]);

		const callableCount = signal(0);
		const callableSeen: number[] = [];

		const callableHandle = watch(
			callableCount,
			(value) => {
				callableSeen.push(value);
			},
			{ immediate: true },
		);

		expect(callableSeen).toEqual([0]);

		callableHandle();
		callableCount.value = 1;
		await nextTick();

		expect(callableSeen).toEqual([0]);
	});

	it("defers a queued pre-flush job while paused and runs it once on resume", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const handle = watch(count, (value) => {
			seen.push(value);
		});

		count.value = 1;
		handle.pause();
		await nextTick();

		expect(seen).toEqual([]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([1]);

		handle.stop();
	});

	it("pauses only the selected watcher for a shared signal", async () => {
		const count = signal(0);
		const pausedSeen: number[] = [];
		const activeSeen: number[] = [];

		const pausedHandle = watch(count, (value) => {
			pausedSeen.push(value);
		});
		const activeHandle = watch(count, (value) => {
			activeSeen.push(value);
		});

		pausedHandle.pause();
		count.value = 1;
		await nextTick();

		expect(pausedSeen).toEqual([]);
		expect(activeSeen).toEqual([1]);

		pausedHandle.stop();
		activeHandle.stop();
	});

	it("defers callback cleanup while paused until the callback reruns", async () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watch(
			count,
			(value, _oldValue, onCleanup) => {
				events.push(`run-${value}`);
				onCleanup(() => {
					events.push(`cleanup-${value}`);
				});
			},
			{ immediate: true },
		);

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

	it("defers resume requested by callback cleanup until the rerun finishes", async () => {
		const count = signal(0);
		const events: Array<string | [number, number | undefined]> = [];

		const handle = watch(
			count,
			(value, oldValue, onCleanup) => {
				events.push([value, oldValue]);
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
			{ immediate: true },
		);

		count.value = 1;
		await nextTick();
		await nextTick();

		expect(events).toEqual([
			[0, undefined],
			"cleanup-0",
			"after-resume-2",
			[1, 0],
			"cleanup-1",
			[2, 1],
		]);

		handle.stop();
	});

	it("coalesces paused changes and reports the last committed value on resume", async () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
			},
			{ immediate: true },
		);

		expect(seen).toEqual([[0, undefined]]);

		count.value = 1;
		await nextTick();
		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
		]);

		handle.pause();
		count.value = 2;
		count.value = 3;
		count.value = 4;
		await nextTick();

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
		]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[4, 1],
		]);

		handle.stop();
	});

	it("does not invoke callback when a paused getter changes back before resume", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const handle = watch(
			() => count.value,
			(value) => {
				seen.push(value);
			},
			{ immediate: true },
		);

		expect(seen).toEqual([0]);

		handle.pause();
		count.value = 1;
		count.value = 0;
		await nextTick();

		expect(seen).toEqual([0]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([0]);

		handle.stop();
	});

	it("preserves flush ordering when paused watchers resume", async () => {
		const count = signal(0);
		const calls: string[] = [];

		const syncHandle = watch(
			count,
			() => {
				calls.push("sync");
			},
			{ flush: "sync" },
		);
		const preHandle = watch(
			count,
			() => {
				calls.push("pre");
			},
			{ flush: "pre" },
		);
		const postHandle = watch(
			count,
			() => {
				calls.push("post");
			},
			{ flush: "post" },
		);

		syncHandle.pause();
		preHandle.pause();
		postHandle.pause();

		count.value = 1;
		await nextTick();
		expect(calls).toEqual([]);

		postHandle.resume();
		preHandle.resume();
		syncHandle.resume();

		expect(calls).toEqual(["sync"]);

		await nextTick();
		expect(calls).toEqual(["sync", "pre", "post"]);

		syncHandle.stop();
		preHandle.stop();
		postHandle.stop();
	});

	it("does not restart after its scope is disposed and resumed", async () => {
		const count = signal(0);
		const seen: number[] = [];
		let handle!: ReturnType<typeof watch>;

		const scope = createScope();
		runWithScope(scope, () => {
			handle = watch(
				count,
				(value) => {
					seen.push(value);
				},
				{ immediate: true },
			);
		});

		expect(seen).toEqual([0]);

		handle.pause();
		count.value = 1;
		await nextTick();
		expect(seen).toEqual([0]);

		disposeScope(scope);
		handle.resume();
		await nextTick();

		count.value = 2;
		await nextTick();

		expect(seen).toEqual([0]);

		handle.stop();
	});

	it("defers resume requested while the source getter is running", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];

		const handle = watch(
			() => {
				const value = count.value;
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
				}
				return value;
			},
			(value, oldValue) => {
				seen.push([value, oldValue]);
			},
			{ immediate: true, flush: "sync" },
		);

		count.value = 1;

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[2, 1],
		]);

		handle.stop();
	});

	it("notifies self-updates made after pausing inside a callback on resume", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const handle = watch(count, (value) => {
			seen.push(value);
			if (value === 1) {
				handle.pause();
				count.value = 2;
			}
		});

		count.value = 1;
		await nextTick();

		expect(seen).toEqual([1]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([1, 2]);

		handle.stop();
	});

	it("does not rerun on resume when a paused callback made no source changes", async () => {
		const count = signal(0);
		const seen: number[] = [];

		const handle = watch(
			() => ({ value: count.value }),
			(value) => {
				seen.push(value.value);
				if (value.value === 1) {
					handle.pause();
				}
			},
		);

		count.value = 1;
		await nextTick();

		expect(seen).toEqual([1]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([1]);

		handle.stop();
	});

	it("notifies self-updates when resumed inside a callback", async () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];

		const handle = watch(count, (value, oldValue) => {
			seen.push([value, oldValue]);
			if (value === 1) {
				handle.pause();
				count.value = 2;
				handle.resume();
			}
		});

		count.value = 1;
		await nextTick();
		await nextTick();

		expect(seen).toEqual([
			[1, 0],
			[2, 1],
		]);

		handle.stop();
	});

	it("commits oldValue before a sync watcher resumes inside a callback", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
				}
			},
			{ flush: "sync" },
		);

		count.value = 1;

		expect(seen).toEqual([
			[1, 0],
			[2, 1],
		]);

		handle.stop();
	});

	it("defers resume until an outer sync callback finishes after reentry", () => {
		const count = signal(0);
		const events: string[] = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				events.push(`run-${value}-${oldValue}`);
				if (value === 1) {
					count.value = 2;
					events.push("after-reentry");
					handle.pause();
					count.value = 3;
					events.push("after-set-3");
					handle.resume();
					events.push("after-resume");
				}
			},
			{ flush: "sync" },
		);

		count.value = 1;

		expect(events).toEqual([
			"run-1-0",
			"run-2-0",
			"after-reentry",
			"after-set-3",
			"after-resume",
			"run-3-1",
		]);

		handle.stop();
	});

	it("defers resume requested while refreshing oldValue", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		let mutateOnRefresh = false;

		const handle = watch(
			() => {
				const value = count.value;
				if (mutateOnRefresh) {
					mutateOnRefresh = false;
					handle.pause();
					count.value = 2;
					handle.resume();
				}
				return value;
			},
			(value, oldValue) => {
				seen.push([value, oldValue]);
				if (value === 1) {
					mutateOnRefresh = true;
				}
			},
			{ flush: "sync" },
		);

		count.value = 1;
		count.value = 3;

		expect(seen).toEqual([
			[1, 0],
			[2, 1],
			[3, 2],
		]);

		handle.stop();
	});

	it("keeps the watcher paused when pause follows resume inside a callback", async () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];

		const handle = watch(count, (value, oldValue) => {
			seen.push([value, oldValue]);
			if (value === 1) {
				handle.pause();
				count.value = 2;
				handle.resume();
				handle.pause();
			}
		});

		count.value = 1;
		await nextTick();
		await nextTick();

		expect(seen).toEqual([[1, 0]]);

		handle.resume();
		await nextTick();

		expect(seen).toEqual([
			[1, 0],
			[2, 1],
		]);

		handle.stop();
	});

	it("does not leave the watcher paused when a callback throws after resume", async () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		const errors: Error[] = [];

		const handle = watch(count, (value, oldValue) => {
			seen.push([value, oldValue]);
			if (value === 1) {
				handle.pause();
				count.value = 2;
				handle.resume();
				throw new Error("resume boom");
			}
		});

		const exceptionPromise = new Promise<void>((resolve) => {
			process.once("uncaughtException", (error) => {
				errors.push(error as Error);
				resolve();
			});
		});

		count.value = 1;
		await exceptionPromise;
		await nextTick();
		await waitForMacroTask();

		count.value = 3;
		await nextTick();

		expect(errors).toHaveLength(1);
		expect(seen).toEqual([
			[1, 0],
			[2, 0],
			[3, 2],
		]);

		handle.stop();
	});

	it("preserves oldValue when a callback throws after resume without changes", async () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		const errors: Error[] = [];

		const handle = watch(count, (value, oldValue) => {
			seen.push([value, oldValue]);
			if (value === 1) {
				handle.pause();
				handle.resume();
				throw new Error("resume boom");
			}
		});

		const exceptionPromise = new Promise<void>((resolve) => {
			process.once("uncaughtException", (error) => {
				errors.push(error as Error);
				resolve();
			});
		});

		count.value = 1;
		await exceptionPromise;
		await nextTick();

		count.value = 2;
		await nextTick();

		expect(errors).toHaveLength(1);
		expect(seen).toEqual([
			[1, 0],
			[2, 0],
		]);

		handle.stop();
	});

	it("does not leave a sync watcher paused when a callback throws after resume", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		const errors: Error[] = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
					throw new Error("sync resume boom");
				}
			},
			{ flush: "sync" },
		);

		try {
			count.value = 1;
		} catch (error) {
			errors.push(error as Error);
		}

		count.value = 3;

		expect(errors).toHaveLength(1);
		expect(seen).toEqual([
			[1, 0],
			[2, 0],
			[3, 2],
		]);

		handle.stop();
	});

	it("reports both errors when a sync resumed callback and rerun throw", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		const errors: unknown[] = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
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
		expect(seen).toEqual([
			[1, 0],
			[2, 0],
		]);

		handle.stop();
	});

	it("does not stay paused when a returned thenable throws during resume", () => {
		const count = signal(0);
		const seen: Array<[number, number | undefined]> = [];
		const errors: unknown[] = [];

		const handle = watch(
			count,
			(value, oldValue) => {
				seen.push([value, oldValue]);
				if (value === 1) {
					handle.pause();
					count.value = 2;
					handle.resume();
					const throwingThenable = {};
					// biome-ignore lint/suspicious/noThenProperty: this reproduces a malformed thenable returned from a watch callback.
					Object.defineProperty(throwingThenable, "then", {
						get() {
							throw new Error("then boom");
						},
					});
					return throwingThenable as unknown as Promise<void>;
				}
			},
			{ flush: "sync" },
		);

		try {
			count.value = 1;
		} catch (error) {
			errors.push(error);
		}

		count.value = 3;

		expect(errors).toHaveLength(1);
		expect(errors[0]).toEqual(
			expect.objectContaining({ message: "then boom" }),
		);
		expect(seen).toEqual([
			[1, 0],
			[2, 0],
			[3, 2],
		]);

		handle.stop();
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

	it("watches readonly signal sources", async () => {
		const source = signal(0);
		const state = readonly(source);
		const seen: Array<[number | undefined, number | undefined]> = [];

		const stop = watch(
			state,
			(value, oldValue) => {
				seen.push([value, oldValue]);
			},
			{ immediate: true },
		);

		source.value = 1;
		await nextTick();
		source.value = 2;
		await nextTick();

		expect(seen).toEqual([
			[0, undefined],
			[1, 0],
			[2, 1],
		]);

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
