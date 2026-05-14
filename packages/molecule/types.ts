import type { ReadonlyShallowDeepSignal } from "../core/deepSignal";

declare const MOLECULE_INSTANCE_BRAND: unique symbol;
declare const MOLECULE_PROPS_BRAND: unique symbol;

export type MoleculeInstance<
	T,
	TProps extends MoleculePropsInput = MoleculePropsInput,
> = T & {
	readonly [MOLECULE_INSTANCE_BRAND]: true;
	readonly [MOLECULE_PROPS_BRAND]?: TProps;
};

export type MoleculePropsInput = object | void;

export type EmptyMoleculeProps = Record<string, never>;

export type ResolvedMoleculeProps<TProps extends MoleculePropsInput> =
	TProps extends void ? EmptyMoleculeProps : TProps;

export type MoleculeSetupProps<TProps extends MoleculePropsInput> =
	ReadonlyShallowDeepSignal<ResolvedMoleculeProps<TProps>>;

export type MoleculePropsGetter<TProps extends MoleculePropsInput> =
	() => ResolvedMoleculeProps<TProps>;

export type MoleculeArgs<TProps extends MoleculePropsInput> =
	TProps extends void
		? []
		: IsAllOptional<TProps> extends true
			? [props?: TProps]
			: [props: TProps];

export type MoleculeGetArgs<TProps extends MoleculePropsInput> =
	TProps extends void
		? []
		: IsAllOptional<TProps> extends true
			? [props?: TProps | MoleculePropsGetter<TProps>]
			: [props: TProps | MoleculePropsGetter<TProps>];

export type IsAllOptional<T> = T extends Record<string, never>
	? true
	: keyof T extends never
		? true
		: {
					[K in keyof T]-?: undefined extends T[K] ? never : K;
				}[keyof T] extends never
			? true
			: false;

export type MoleculeFactory<
	TReturn extends object,
	TProps extends MoleculePropsInput = void,
> = (...args: MoleculeArgs<TProps>) => MoleculeInstance<TReturn, TProps>;
