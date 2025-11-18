import {
	TrackOpType,
	pauseTracking,
	resumeTracking,
	track,
} from "../../reactivity";

import { createBaseHandlers, warnReadonlyOperation } from "./base";
import type { HandlerHooks } from "./types";

type Instrumentations = Record<PropertyKey, unknown>;

const arrayPrototype = Array.prototype;

type IdentityMethod = "includes" | "indexOf" | "lastIndexOf";
type MutatingMethod = "push" | "pop" | "shift" | "unshift" | "splice";

export function createArrayHandlers(hooks: HandlerHooks): ProxyHandler<object> {
	const baseHandlers = createBaseHandlers(hooks);
	const instrumentations = createArrayInstrumentations(hooks);
	const hasInstrumentation = createInstrumentationLookup(instrumentations);

	return {
		...baseHandlers,
		get(target, key, receiver) {
			if (typeof key === "string" && hasInstrumentation(key) && key in target) {
				return Reflect.get(instrumentations, key, receiver);
			}
			return baseHandlers.get?.(target, key, receiver);
		},
	};
}

function createArrayInstrumentations(hooks: HandlerHooks): Instrumentations {
	const instrumentations: Instrumentations = Object.create(null);
	const identityMethods: IdentityMethod[] = [
		"includes",
		"indexOf",
		"lastIndexOf",
	];
	for (const method of identityMethods) {
		instrumentations[method] = createIdentityInstrumentation(method, hooks);
	}

	const mutatingMethods: MutatingMethod[] = [
		"push",
		"pop",
		"shift",
		"unshift",
		"splice",
	];
	for (const method of mutatingMethods) {
		instrumentations[method] = createMutationInstrumentation(method, hooks);
	}

	return instrumentations;
}

function createIdentityInstrumentation(
	method: IdentityMethod,
	hooks: HandlerHooks,
): (...args: unknown[]) => unknown {
	return function identityInstrumentation(this: unknown[], ...args: unknown[]) {
		const target = getRawArrayTarget(this, hooks.rawSymbol);
		trackArrayContents(target);
		const result = callArrayMethod(method, target, args);
		if (shouldRetryIdentitySearch(method, result)) {
			const unwrappedArgs = args.map((value) => hooks.unwrap(value));
			return callArrayMethod(method, target, unwrappedArgs);
		}
		return result;
	};
}

function createMutationInstrumentation(
	method: MutatingMethod,
	hooks: HandlerHooks,
): (...args: unknown[]) => unknown {
	if (hooks.isReadonly) {
		return function readonlyMutationInstrumentation(
			this: unknown[],
			...args: unknown[]
		) {
			warnReadonlyOperation(method);
			const target = getRawArrayTarget(this, hooks.rawSymbol);
			return simulateReadonlyMutation(method, target, args);
		};
	}

	return function mutationInstrumentation(this: unknown[], ...args: unknown[]) {
		return runWithoutTracking(this, method, args);
	};
}

function trackArrayContents(target: unknown[]): void {
	track(target, TrackOpType.ITERATE);
	track(target, TrackOpType.GET, "length");
	for (let index = 0; index < target.length; index += 1) {
		track(target, TrackOpType.GET, String(index));
	}
}

function shouldRetryIdentitySearch(
	method: IdentityMethod,
	result: unknown,
): boolean {
	if (method === "includes") {
		return result === false;
	}
	return result === -1;
}

function runWithoutTracking(
	receiver: unknown[],
	method: MutatingMethod,
	args: unknown[],
): unknown {
	pauseTracking();
	try {
		return callArrayMethod(method, receiver, args);
	} finally {
		resumeTracking();
	}
}

function simulateReadonlyMutation(
	method: MutatingMethod,
	target: unknown[],
	args: unknown[],
): unknown {
	const clone = target.slice();
	return callArrayMethod(method, clone, args);
}

function getRawArrayTarget(proxy: object, rawSymbol: symbol): unknown[] {
	return Reflect.get(proxy, rawSymbol) as unknown[];
}

function createInstrumentationLookup(instrumentations: Instrumentations) {
	return (key: string): boolean =>
		Object.prototype.hasOwnProperty.call(instrumentations, key);
}

function callArrayMethod(
	method: IdentityMethod | MutatingMethod,
	target: unknown[],
	args: unknown[],
): unknown {
	const fn = arrayPrototype[method] as (
		this: unknown[],
		...methodArgs: unknown[]
	) => unknown;
	return Reflect.apply(fn, target, args);
}
