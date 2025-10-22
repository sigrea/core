declare const LOGIC_INSTANCE_BRAND: unique symbol;

export type LogicInstance<T> = T & {
	readonly [LOGIC_INSTANCE_BRAND]: true;
};

export type LogicArgs<TProps> = TProps extends void
	? []
	: IsAllOptional<TProps> extends true
		? [props?: TProps]
		: [props: TProps];

export interface LogicContext {
	get<TReturn extends object, TProps = void>(
		logic: LogicFunction<TReturn, TProps>,
		...args: LogicArgs<TProps>
	): LogicInstance<TReturn>;
}

export type IsAllOptional<T> = T extends Record<string, never>
	? true
	: keyof T extends never
		? true
		: {
					[K in keyof T]-?: undefined extends T[K] ? never : K;
				}[keyof T] extends never
			? true
			: false;

export type LogicFunction<TReturn extends object, TProps = void> = (
	...args: LogicArgs<TProps>
) => LogicInstance<TReturn>;
