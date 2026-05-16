import { afterEach, describe, expect, it, vi } from "vitest";

import { computed } from "../../core/computed";
import { nextTick } from "../../core/nextTick";
import { onDispose } from "../../core/scope";
import { signal } from "../../core/signal";
import { toSignal } from "../../core/toSignal";
import { watch } from "../../core/watch";
import { watchEffect } from "../../core/watchEffect";
import { get } from "../get";
import {
	disposeMolecule,
	mountMolecule,
	unmountMolecule,
	updateMoleculeProps,
} from "../internals";
import { onMount } from "../lifecycle/onMount";
import { molecule } from "../molecule";
import { disposeTrackedMolecules, trackMolecule } from "../testing";

afterEach(() => {
	disposeTrackedMolecules();
});

describe("molecule", () => {
	it("creates reusable molecule instances with reactive state", () => {
		const CounterMolecule = molecule(() => {
			const count = signal(0);
			const doubled = computed(() => count.value * 2);
			const increment = () => {
				count.value += 1;
			};

			return { count, doubled, increment };
		});

		const counter = CounterMolecule();
		trackMolecule(counter);

		expect(counter.count.value).toBe(0);
		expect(counter.doubled.value).toBe(0);

		counter.increment();
		expect(counter.count.value).toBe(1);
		expect(counter.doubled.value).toBe(2);
	});

	it("passes props to the setup function", () => {
		const CounterMolecule = molecule((props: { initialCount: number }) => {
			const count = signal(props.initialCount);
			return { count };
		});

		const instance = CounterMolecule({ initialCount: 3 });
		trackMolecule(instance);

		expect(instance.count.value).toBe(3);
	});

	it("keeps setup props live when molecule props are updated", () => {
		let capturedProps: { value: string; optional?: number } | undefined;

		const DemoMolecule = molecule(
			(props: { value: string; optional?: number }) => {
				capturedProps = props;
				const value = computed(() => props.value);
				const optional = computed(() => props.optional);
				const hasOptional = computed(() => "optional" in props);

				return { hasOptional, optional, value };
			},
		);

		const instance = DemoMolecule({ optional: 1, value: "initial" });
		trackMolecule(instance);

		expect(instance.value.value).toBe("initial");
		expect(instance.optional.value).toBe(1);
		expect(instance.hasOptional.value).toBe(true);
		const initialProps = capturedProps;

		updateMoleculeProps(instance, { value: "next" });

		expect(instance.value.value).toBe("next");
		expect(instance.optional.value).toBeUndefined();
		expect(instance.hasOptional.value).toBe(false);
		expect(capturedProps).toBe(initialProps);
	});

	it("exposes live props as keyed readonly signals", () => {
		const DialogMolecule = molecule(
			(props: { disabled?: boolean; open: boolean }) => {
				const disabled = toSignal(props, "disabled");
				const open = toSignal(props, "open");

				return { disabled, open };
			},
		);

		const instance = DialogMolecule({ open: false });
		trackMolecule(instance);

		expect(instance.open.value).toBe(false);
		expect(instance.disabled.value).toBeUndefined();

		updateMoleculeProps(instance, { disabled: true, open: true });

		expect(instance.open.value).toBe(true);
		expect(instance.disabled.value).toBe(true);

		updateMoleculeProps(instance, { open: false });

		expect(instance.open.value).toBe(false);
		expect(instance.disabled.value).toBeUndefined();

		expect(() => {
			(instance.open as { value: boolean }).value = true;
		}).toThrow("Cannot assign to a readonly computed value.");
	});

	it("rejects non-plain object props containers", () => {
		const DemoMolecule = molecule((props: { value?: number }) => {
			return { value: computed(() => props.value) };
		});

		expect(() => DemoMolecule(null as never)).toThrow(
			"molecule props must be a plain object.",
		);
		expect(() => DemoMolecule(1 as never)).toThrow(
			"molecule props must be a plain object.",
		);
		expect(() => DemoMolecule([] as never)).toThrow(
			"molecule props must be a plain object.",
		);
		expect(() => DemoMolecule((() => ({})) as never)).toThrow(
			"molecule props must be a plain object.",
		);

		const instance = DemoMolecule({ value: 1 });
		trackMolecule(instance);

		expect(() => updateMoleculeProps(instance, [] as never)).toThrow(
			"molecule props must be a plain object.",
		);
	});

	it("passes nested prop values through without coercing them", () => {
		const count = signal(1);
		const nested = { label: "nested" };
		const items = new Map([["id", 1]]);

		const DemoMolecule = molecule(
			(props: {
				count: typeof count;
				items: typeof items;
				nested: typeof nested;
			}) => {
				return {
					count: props.count,
					items: props.items,
					nested: props.nested,
				};
			},
		);

		const instance = DemoMolecule({ count, items, nested });
		trackMolecule(instance);

		expect(instance.count).toBe(count);
		expect(instance.items).toBe(items);
		expect(instance.nested).toBe(nested);
	});

	it("replaces signal-valued top-level props without mutating the old signal", () => {
		const initial = signal("initial");

		const DemoMolecule = molecule(
			(props: { value: string | typeof initial }) => {
				return {
					value: computed(() => props.value),
				};
			},
		);

		const instance = DemoMolecule({ value: initial });
		trackMolecule(instance);

		expect(instance.value.value).toBe(initial);

		updateMoleculeProps(instance, { value: "next" });

		expect(instance.value.value).toBe("next");
		expect(initial.value).toBe("initial");
	});

	it("runs onMount callbacks when mounted and runs returned cleanups on dispose", () => {
		const cleanup = vi.fn();
		const mounts = vi.fn();

		const DemoMolecule = molecule(() => {
			onMount(() => {
				mounts();
				return () => {
					cleanup();
				};
			});

			return {};
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(mounts).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();

		mountMolecule(instance);
		expect(mounts).toHaveBeenCalledTimes(1);
		expect(cleanup).not.toHaveBeenCalled();

		disposeMolecule(instance);

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("defers watchEffect until the molecule is mounted", async () => {
		const runs: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			watchEffect(() => {
				runs.push(count.value);
			});

			return { count };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(runs).toEqual([]);

		instance.count.value = 1;
		await nextTick();
		expect(runs).toEqual([]);

		mountMolecule(instance);
		expect(runs).toEqual([1]);

		instance.count.value = 2;
		await nextTick();
		expect(runs).toEqual([1, 2]);

		unmountMolecule(instance);

		instance.count.value = 3;
		await nextTick();
		expect(runs).toEqual([1, 2]);

		mountMolecule(instance);
		expect(runs).toEqual([1, 2, 3]);
	});

	it("defers sync resume requested by a deferred watchEffect initial run", () => {
		const events: string[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watchEffect(
				() => {
					const value = count.value;
					events.push(`run-${value}`);
					if (value === 0) {
						handle.pause();
						count.value = 1;
						handle.resume();
						events.push("after-resume");
					}
				},
				{ flush: "sync" },
			);

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		mountMolecule(instance);

		expect(events).toEqual(["run-0", "after-resume", "run-1"]);
	});

	it("defers watch until mounted and preserves immediate behavior on mount", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			watch(
				() => count.value,
				(value) => {
					values.push(value);
				},
				{ immediate: true },
			);

			return { count };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(values).toEqual([]);

		mountMolecule(instance);
		expect(values).toEqual([0]);

		instance.count.value = 1;
		await nextTick();
		expect(values).toEqual([0, 1]);

		unmountMolecule(instance);

		instance.count.value = 2;
		await nextTick();
		expect(values).toEqual([0, 1]);

		mountMolecule(instance);
		expect(values).toEqual([0, 1, 2]);
	});

	it("keeps a deferred watch paused until resume after mount", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				() => count.value,
				(value) => {
					values.push(value);
				},
				{ immediate: true },
			);
			handle.pause();

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		instance.count.value = 1;
		await nextTick();
		expect(values).toEqual([]);

		mountMolecule(instance);
		expect(values).toEqual([]);

		instance.count.value = 2;
		await nextTick();
		expect(values).toEqual([]);

		instance.handle.resume();
		await nextTick();

		expect(values).toEqual([2]);
	});

	it("keeps the mounted value as oldValue for paused deferred watches", async () => {
		const values: Array<[number, number]> = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				() => count.value,
				(value, oldValue) => {
					values.push([value, oldValue]);
				},
			);
			handle.pause();

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		instance.count.value = 1;
		mountMolecule(instance);

		instance.count.value = 2;
		await nextTick();
		expect(values).toEqual([]);

		instance.handle.resume();
		await nextTick();

		expect(values).toEqual([[2, 1]]);
	});

	it("defers resume requested by a deferred lazy watch initial getter", () => {
		const values: Array<[number, number]> = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				() => {
					const value = count.value;
					if (value === 0) {
						handle.pause();
						count.value = 2;
						handle.resume();
					}
					return value;
				},
				(value, oldValue) => {
					values.push([value, oldValue]);
				},
				{ flush: "sync" },
			);

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		expect(values).toEqual([]);

		mountMolecule(instance);
		expect(values).toEqual([[2, 0]]);

		instance.count.value = 3;
		expect(values).toEqual([
			[2, 0],
			[3, 2],
		]);
	});

	it("honors stop called from a deferred immediate callback", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				count,
				(value) => {
					values.push(value);
					handle.stop();
				},
				{ immediate: true },
			);

			return { count };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		mountMolecule(instance);
		expect(values).toEqual([0]);

		instance.count.value = 1;
		await nextTick();

		expect(values).toEqual([0]);
	});

	it("honors pause called from a deferred immediate callback", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				count,
				(value) => {
					values.push(value);
					handle.pause();
				},
				{ immediate: true },
			);

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		mountMolecule(instance);
		expect(values).toEqual([0]);

		instance.count.value = 1;
		await nextTick();
		expect(values).toEqual([0]);

		instance.handle.resume();
		await nextTick();

		expect(values).toEqual([0, 1]);
	});

	it("does not restart a deferred watch when resumed after unmount", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watch(
				() => count.value,
				(value) => {
					values.push(value);
				},
				{ immediate: true },
			);

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		mountMolecule(instance);
		expect(values).toEqual([0]);

		instance.handle.pause();
		unmountMolecule(instance);
		instance.handle.resume();

		instance.count.value = 1;
		await nextTick();

		expect(values).toEqual([0]);
	});

	it("does not restart a deferred watchEffect when resumed after unmount", async () => {
		const values: number[] = [];

		const DemoMolecule = molecule(() => {
			const count = signal(0);

			const handle = watchEffect(() => {
				values.push(count.value);
			});

			return { count, handle };
		});

		const instance = DemoMolecule();
		trackMolecule(instance);

		mountMolecule(instance);
		expect(values).toEqual([0]);

		instance.handle.pause();
		unmountMolecule(instance);
		instance.handle.resume();

		instance.count.value = 1;
		await nextTick();

		expect(values).toEqual([0]);
	});

	it("disposes child molecule when the parent is cleaned up", () => {
		const childCleanup = vi.fn();

		const ChildMolecule = molecule(() => {
			onDispose(() => {
				childCleanup();
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			get(ChildMolecule);
			return {};
		});

		const parent = ParentMolecule();
		trackMolecule(parent);

		disposeMolecule(parent);

		expect(childCleanup).toHaveBeenCalledTimes(1);
	});

	it("disposes scope when setup throws", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onDispose(() => {
				cleanup();
			});

			throw new Error("boom");
		});

		expect(() => DemoMolecule()).toThrow("boom");
		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it("throws when setup returns a promise", () => {
		const DemoMolecule = molecule(
			() => Promise.resolve({}) as unknown as object,
		);

		expect(() => DemoMolecule()).toThrow(
			"molecule setup must return an object synchronously",
		);
	});

	it("disposeTrackedMolecules tears down every tracked instance", () => {
		const cleanup = vi.fn();

		const DemoMolecule = molecule(() => {
			onDispose(() => {
				cleanup();
			});
			return {};
		});

		trackMolecule(DemoMolecule());
		trackMolecule(DemoMolecule());

		disposeTrackedMolecules();

		expect(cleanup).toHaveBeenCalledTimes(2);
	});

	it("mounts and unmounts child molecules along the parent molecule", () => {
		const events: string[] = [];

		const ChildMolecule = molecule(() => {
			onMount(() => {
				events.push("child-mount");
				return () => {
					events.push("child-unmount");
				};
			});
			return {};
		});

		const ParentMolecule = molecule(() => {
			get(ChildMolecule);
			onMount(() => {
				events.push("parent-mount");
				return () => {
					events.push("parent-unmount");
				};
			});
			return {};
		});

		const parent = ParentMolecule();
		trackMolecule(parent);

		mountMolecule(parent);
		expect(events).toEqual(["child-mount", "parent-mount"]);

		unmountMolecule(parent);
		expect(events).toEqual([
			"child-mount",
			"parent-mount",
			"child-unmount",
			"parent-unmount",
		]);
	});

	it("passes props to child molecule instances via get", () => {
		const ChildMolecule = molecule((props: { id: number }) => {
			const identifier = computed(() => props.id);
			return { identifier };
		});

		const ParentMolecule = molecule((props: { childId: number }) => {
			const child = get(ChildMolecule, { id: props.childId });
			return { child };
		});

		const parent = ParentMolecule({ childId: 42 });
		trackMolecule(parent);
		expect(parent.child.identifier.value).toBe(42);

		updateMoleculeProps(parent, { childId: 7 });

		expect(parent.child.identifier.value).toBe(42);
	});

	it("updates child molecule props when get receives a props getter", () => {
		let childSetupRuns = 0;
		const ChildMolecule = molecule((props: { id: number }) => {
			childSetupRuns += 1;
			const identifier = computed(() => props.id);
			return { identifier };
		});

		const ParentMolecule = molecule((props: { childId: number }) => {
			const child = get(ChildMolecule, () => ({ id: props.childId }));
			return { child };
		});

		const parent = ParentMolecule({ childId: 42 });
		trackMolecule(parent);

		expect(parent.child.identifier.value).toBe(42);

		updateMoleculeProps(parent, { childId: 7 });

		expect(parent.child.identifier.value).toBe(7);
		expect(childSetupRuns).toBe(1);
	});

	it("tracks only top-level props through child props getters", () => {
		const ChildMolecule = molecule(
			(props: { options: { placement: string } }) => {
				const placement = computed(() => props.options.placement);
				return { placement };
			},
		);

		const ParentMolecule = molecule(
			(props: { options: { placement: string } }) => {
				const child = get(ChildMolecule, () => ({
					options: props.options,
				}));
				return { child };
			},
		);

		const options = { placement: "start" };
		const parent = ParentMolecule({ options });
		trackMolecule(parent);

		expect(parent.child.placement.value).toBe("start");

		options.placement = "end";

		expect(parent.child.placement.value).toBe("start");

		updateMoleculeProps(parent, { options: { placement: "end" } });

		expect(parent.child.placement.value).toBe("end");
	});

	it("rejects invalid child props returned from a props getter", () => {
		const ChildMolecule = molecule((props: { value: string }) => {
			return { value: computed(() => props.value) };
		});
		const ParentMolecule = molecule(() => {
			get(ChildMolecule, () => [] as never);
			return {};
		});

		expect(() => ParentMolecule()).toThrow(
			"molecule props must be a plain object.",
		);
	});

	it("tracks pass-through parent props in get props getters", () => {
		const ChildMolecule = molecule((props: { id: number; label?: string }) => {
			const identifier = computed(() => props.id);
			const label = computed(() => props.label);
			const hasLabel = computed(() => "label" in props);

			return { hasLabel, identifier, label };
		});

		const ParentMolecule = molecule((props: { id: number; label?: string }) => {
			const child = get(ChildMolecule, () => props);
			return { child };
		});

		const parent = ParentMolecule({ id: 42, label: "initial" });
		trackMolecule(parent);

		expect(parent.child.identifier.value).toBe(42);
		expect(parent.child.label.value).toBe("initial");
		expect(parent.child.hasLabel.value).toBe(true);

		updateMoleculeProps(parent, { id: 7 });

		expect(parent.child.identifier.value).toBe(7);
		expect(parent.child.label.value).toBeUndefined();
		expect(parent.child.hasLabel.value).toBe(false);
	});

	it("stops child props getter tracking when the child is disposed", () => {
		const ChildMolecule = molecule((props: { id: number }) => {
			const identifier = computed(() => props.id);
			return { identifier };
		});
		let getterRuns = 0;

		const ParentMolecule = molecule((props: { id: number }) => {
			const child = get(ChildMolecule, () => {
				getterRuns += 1;
				return { id: props.id };
			});

			return { child };
		});

		const parent = ParentMolecule({ id: 1 });
		trackMolecule(parent);

		expect(getterRuns).toBe(1);

		disposeMolecule(parent.child);
		updateMoleculeProps(parent, { id: 2 });

		expect(getterRuns).toBe(1);
	});

	it("does not run a queued child props getter after the child is disposed", () => {
		const ChildMolecule = molecule((props: { id: number }) => {
			const identifier = computed(() => props.id);
			return { identifier };
		});
		let getterRuns = 0;

		const ParentMolecule = molecule(
			(props: { disposeChild: boolean; id: number }) => {
				const childRef: { current?: ReturnType<typeof ChildMolecule> } = {};

				watch(
					() => props.disposeChild,
					(shouldDispose) => {
						if (shouldDispose && childRef.current !== undefined) {
							disposeMolecule(childRef.current);
						}
					},
					{ flush: "sync" },
				);

				const child = get(ChildMolecule, () => {
					getterRuns += 1;
					return { id: props.id };
				});
				childRef.current = child;

				return { child };
			},
		);

		const parent = ParentMolecule({ disposeChild: false, id: 1 });
		trackMolecule(parent);
		mountMolecule(parent);

		expect(getterRuns).toBe(1);

		updateMoleculeProps(parent, { disposeChild: true, id: 2 });

		expect(getterRuns).toBe(1);
	});

	it("throws when get is called outside molecule setup", () => {
		const ChildMolecule = molecule(() => ({}));

		expect(() => get(ChildMolecule)).toThrow(
			"get(...) can only be called synchronously during molecule setup.",
		);
	});
});
