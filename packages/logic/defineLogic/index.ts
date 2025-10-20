import { createScope, disposeScope, runWithScope } from "../../core/scope";

import {
	type LogicMetadata,
	createMetadata,
	finalizeMetadata,
	getLogicMetadata,
	linkChildLogic,
} from "../internals";
import type {
	LogicArgs,
	LogicContext,
	LogicFunction,
	LogicInstance,
} from "../types";

export function defineLogic<TProps = void>(): <TReturn extends object>(
	setup: (props: TProps, context: LogicContext) => TReturn,
) => LogicFunction<TReturn, TProps> {
	return function defineLogicWithSetup<TReturn extends object>(
		setup: (props: TProps, context: LogicContext) => TReturn,
	): LogicFunction<TReturn, TProps> {
		const logicFactory = ((...args: LogicArgs<TProps>) => {
			const props = args.length === 0 ? ({} as TProps) : (args[0] as TProps);

			const scope = createScope();
			const metadata: LogicMetadata = createMetadata(scope);
			try {
				const logic = runWithScope(scope, () => {
					const instance = setup(props, {
						get<TChild extends object, TChildProps = void>(
							childFactory: LogicFunction<TChild, TChildProps>,
							...childArgs: LogicArgs<TChildProps>
						) {
							if (typeof childFactory !== "function") {
								throw new TypeError(
									"get(...) expects a logic factory returned by defineLogic().",
								);
							}

							const child = childFactory(...childArgs);
							const childMetadata = getLogicMetadata(child);
							if (childMetadata === undefined) {
								throw new TypeError(
									"get(...) expects a logic factory returned by defineLogic().",
								);
							}
							return linkChildLogic(metadata, childMetadata, child);
						},
					});

					if (instance === null || typeof instance !== "object") {
						throw new TypeError(
							"defineLogic setup must return an object containing the public API.",
						);
					}

					return instance;
				});

				finalizeMetadata(metadata, logic as object);

				return logic as LogicInstance<TReturn>;
			} catch (error) {
				disposeScope(scope);
				throw error;
			}
		}) as LogicFunction<TReturn, TProps>;

		return logicFactory;
	};
}
