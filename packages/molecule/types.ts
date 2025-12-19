declare const MOLECULE_INSTANCE_BRAND: unique symbol;

export type MoleculeInstance<T> = T & {
	readonly [MOLECULE_INSTANCE_BRAND]: true;
};

export type MoleculeArgs<TProps> = TProps extends void
	? []
	: IsAllOptional<TProps> extends true
		? [props?: TProps]
		: [props: TProps];

export type IsAllOptional<T> = T extends Record<string, never>
	? true
	: keyof T extends never
		? true
		: {
					[K in keyof T]-?: undefined extends T[K] ? never : K;
				}[keyof T] extends never
			? true
			: false;

export type MoleculeFactory<TReturn extends object, TProps = void> = (
	...args: MoleculeArgs<TProps>
) => MoleculeInstance<TReturn>;
