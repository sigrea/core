export interface HandlerHooks {
	wrap(value: unknown, key?: PropertyKey): unknown;
	unwrap(value: unknown): unknown;
	markVersionChanged(target: object): void;
	rawSymbol: symbol;
	isReadonly?: boolean;
}

export type HandlerFactory = (hooks: HandlerHooks) => ProxyHandler<object>;
