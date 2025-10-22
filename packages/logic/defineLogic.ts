import { createScope, disposeScope, runWithScope } from "../core/scope";

import {
	type LogicMetadata,
	createMetadata,
	finalizeMetadata,
	getLogicMetadata,
	linkChildLogic,
} from "./internals";
import type {
	LogicArgs,
	LogicContext,
	LogicFunction,
	LogicInstance,
} from "./types";

const INVALID_SETUP_RETURN_MESSAGE =
	"defineLogic setup must return an object containing the public API.";
const INVALID_LOGIC_FACTORY_MESSAGE =
	"get(...) expects a logic factory returned by defineLogic().";

export function defineLogic<TProps = void>(): <TReturn extends object>(
	setup: (props: TProps, context: LogicContext) => TReturn,
) => LogicFunction<TReturn, TProps> {
	return function defineLogicWithSetup<TReturn extends object>(
		setup: (props: TProps, context: LogicContext) => TReturn,
	): LogicFunction<TReturn, TProps> {
		return createLogicFactory(setup);
	};
}

function createLogicFactory<TReturn extends object, TProps>(
	setup: (props: TProps, context: LogicContext) => TReturn,
): LogicFunction<TReturn, TProps> {
	return ((...args: LogicArgs<TProps>) => {
		const props = resolveProps(args);
		const scope = createScope();
		const metadata = createMetadata(scope);

		try {
			const logic = runWithScope(scope, () => {
				const context = createLogicContext(metadata);
				const instance = ensureSetupResult(setup(props, context));
				return instance;
			});

			finalizeMetadata(metadata, logic as object);

			return logic as LogicInstance<TReturn>;
		} catch (error) {
			disposeScope(scope);
			throw error;
		}
	}) as LogicFunction<TReturn, TProps>;
}

function createLogicContext(metadata: LogicMetadata): LogicContext {
	return {
		get<TReturn extends object, TProps = void>(
			childFactory: LogicFunction<TReturn, TProps>,
			...childArgs: LogicArgs<TProps>
		): LogicInstance<TReturn> {
			if (typeof childFactory !== "function") {
				throw new TypeError(INVALID_LOGIC_FACTORY_MESSAGE);
			}

			const child = childFactory(...childArgs);
			const childMetadata = getLogicMetadata(child);

			if (childMetadata === undefined) {
				throw new TypeError(INVALID_LOGIC_FACTORY_MESSAGE);
			}

			return linkChildLogic(metadata, childMetadata, child);
		},
	};
}

function resolveProps<TProps>(args: LogicArgs<TProps>): TProps {
	if (args.length === 0) {
		return {} as TProps;
	}
	return args[0] as TProps;
}

function ensureSetupResult<TReturn extends object>(
	value: TReturn | null | undefined,
): TReturn {
	if (value === null || typeof value !== "object") {
		throw new TypeError(INVALID_SETUP_RETURN_MESSAGE);
	}

	return value;
}
