import { Effect, untracked } from "../core/reactivity";
import { onDispose } from "../core/scope";
import {
	getActiveMoleculeMetadata,
	getMoleculeMetadata,
	linkChildMolecule,
	updateMoleculeProps,
} from "./internals";
import { snapshotMoleculeProps } from "./props";
import type {
	MoleculeFactory,
	MoleculeGetArgs,
	MoleculeInstance,
	MoleculePropsGetter,
	MoleculePropsInput,
} from "./types";

const GET_OUTSIDE_SETUP_MESSAGE =
	"get(...) can only be called synchronously during molecule setup.";
const INVALID_MOLECULE_FACTORY_MESSAGE =
	"get(...) expects a molecule factory returned by molecule().";

export function get<
	TReturn extends object,
	TProps extends MoleculePropsInput = void,
>(
	childFactory: MoleculeFactory<TReturn, TProps>,
	...args: MoleculeGetArgs<TProps>
): MoleculeInstance<TReturn, TProps> {
	const parentMetadata = getActiveMoleculeMetadata();
	if (parentMetadata === undefined) {
		throw new Error(GET_OUTSIDE_SETUP_MESSAGE);
	}

	if (typeof childFactory !== "function") {
		throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
	}

	if (isPropsGetter<TProps>(args[0])) {
		let child: MoleculeInstance<TReturn, TProps> | undefined;
		let propsEffectActive = true;
		const propsGetter = args[0];
		const propsEffect = new Effect(() => {
			if (!propsEffectActive) {
				return;
			}
			const nextProps = snapshotMoleculeProps(propsGetter());
			if (child === undefined) {
				child = untracked(() =>
					childFactory(
						...([nextProps] as unknown as Parameters<typeof childFactory>),
					),
				);
				return;
			}
			updateMoleculeProps(child, nextProps);
		});
		propsEffect.scheduler = () => {
			if (!propsEffectActive) {
				return;
			}
			propsEffect.run();
		};

		const stopPropsEffect = () => {
			if (!propsEffectActive) {
				return;
			}
			propsEffectActive = false;
			propsEffect.stop();
		};

		try {
			propsEffect.run();
		} catch (error) {
			stopPropsEffect();
			throw error;
		}

		if (child === undefined) {
			stopPropsEffect();
			throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
		}

		try {
			const childMetadata = getMoleculeMetadata(child);
			if (childMetadata === undefined) {
				throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
			}
			const linkedChild = linkChildMolecule(
				parentMetadata,
				childMetadata,
				child,
			);
			onDispose(stopPropsEffect, parentMetadata.scope);
			onDispose(stopPropsEffect, childMetadata.scope);
			return linkedChild;
		} catch (error) {
			stopPropsEffect();
			throw error;
		}
	}

	const child = childFactory(...(args as Parameters<typeof childFactory>));
	const childMetadata = getMoleculeMetadata(child);

	if (childMetadata === undefined) {
		throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
	}

	return linkChildMolecule(parentMetadata, childMetadata, child);
}

function isPropsGetter<TProps extends MoleculePropsInput>(
	value: unknown,
): value is MoleculePropsGetter<TProps> {
	return typeof value === "function";
}
