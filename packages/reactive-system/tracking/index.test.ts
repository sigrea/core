import { describe, expect, it, vi } from "vitest";
import { SubscriberFlags, startTracking } from "../core";
import type { Dependency, Subscriber } from "../core";
import { endTracking, link } from "./index";

type LifecycleDependency = Dependency & {
	_untrackSubscriber?: (sub: Subscriber) => void;
};

function createDependency(
	untrack?: (sub: Subscriber) => void,
): LifecycleDependency {
	return {
		subs: undefined,
		subsTail: undefined,
		_untrackSubscriber: untrack,
	};
}

function createSubscriber(): Subscriber {
	return {
		flags: SubscriberFlags.Effect,
		deps: undefined,
		depsTail: undefined,
	};
}

describe("reactive-system/tracking", () => {
	it("returns link reference from underlying reactive system", () => {
		const dep = createDependency();
		const sub = createSubscriber();

		startTracking(sub);
		const createdLink = link(dep, sub);
		endTracking(sub);

		expect(createdLink).toBeDefined();
		expect(createdLink?.dep).toBe(dep);
		expect(createdLink?.sub).toBe(sub);
	});

	it("calls _untrackSubscriber when dependencies are removed", () => {
		const firstUntrack = vi.fn();
		const secondUntrack = vi.fn();

		const firstDep = createDependency(firstUntrack);
		const secondDep = createDependency(secondUntrack);
		const sub = createSubscriber();

		startTracking(sub);
		link(firstDep, sub);
		endTracking(sub);

		expect(firstUntrack).not.toHaveBeenCalled();

		startTracking(sub);
		link(secondDep, sub);
		endTracking(sub);

		expect(firstUntrack).toHaveBeenCalledWith(sub);
		expect(secondUntrack).not.toHaveBeenCalled();
	});

	it("clears cached dependencies when subscriber no longer tracks any", () => {
		const untrack = vi.fn();
		const dep = createDependency(untrack);
		const sub = createSubscriber();

		startTracking(sub);
		link(dep, sub);
		endTracking(sub);

		startTracking(sub);
		// No dependencies are linked in this cycle
		endTracking(sub);

		expect(untrack).toHaveBeenCalledWith(sub);

		untrack.mockClear();

		startTracking(sub);
		// Still no dependencies; ensure double cleanup does not trigger again
		endTracking(sub);

		expect(untrack).not.toHaveBeenCalled();
	});

	it("only unsubscribes dependencies removed between tracking passes", () => {
		const firstUntrack = vi.fn();
		const secondUntrack = vi.fn();
		const thirdUntrack = vi.fn();

		const first = createDependency(firstUntrack);
		const second = createDependency(secondUntrack);
		const third = createDependency(thirdUntrack);
		const sub = createSubscriber();

		startTracking(sub);
		link(first, sub);
		link(second, sub);
		endTracking(sub);

		startTracking(sub);
		link(second, sub);
		link(third, sub);
		endTracking(sub);

		expect(firstUntrack).toHaveBeenCalledWith(sub);
		expect(secondUntrack).not.toHaveBeenCalled();
		expect(thirdUntrack).not.toHaveBeenCalled();
	});

	it("does not untrack dependencies that persist across runs", () => {
		const untrack = vi.fn();
		const dep = createDependency(untrack);
		const sub = createSubscriber();

		startTracking(sub);
		link(dep, sub);
		endTracking(sub);

		startTracking(sub);
		link(dep, sub);
		endTracking(sub);

		expect(untrack).not.toHaveBeenCalled();
	});
});
