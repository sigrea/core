import { createScope, disposeScope, runWithScope } from "../core/scope";

import {
	type MoleculeMetadata,
	createMetadata,
	finalizeMetadata,
	getMoleculeMetadata,
	linkChildMolecule,
} from "./internals";
import type {
	MoleculeArgs,
	MoleculeContext,
	MoleculeFactory,
	MoleculeInstance,
} from "./types";

const INVALID_SETUP_RETURN_MESSAGE =
	"molecule setup must return an object containing the public API.";
const INVALID_MOLECULE_FACTORY_MESSAGE =
	"get(...) expects a molecule factory returned by molecule().";

export function molecule<TProps = void>(): <TReturn extends object>(
	setup: (props: TProps, context: MoleculeContext) => TReturn,
) => MoleculeFactory<TReturn, TProps> {
	return function moleculeWithSetup<TReturn extends object>(
		setup: (props: TProps, context: MoleculeContext) => TReturn,
	): MoleculeFactory<TReturn, TProps> {
		return createMoleculeFactory(setup);
	};
}

function createMoleculeFactory<TReturn extends object, TProps>(
	setup: (props: TProps, context: MoleculeContext) => TReturn,
): MoleculeFactory<TReturn, TProps> {
	return ((...args: MoleculeArgs<TProps>) => {
		const props = resolveProps(args);
		const scope = createScope();
		const metadata = createMetadata(scope);

		try {
			const moleculeInstance = runWithScope(scope, () => {
				const context = createMoleculeContext(metadata);
				const instance = ensureSetupResult(setup(props, context));
				return instance;
			});

			finalizeMetadata(metadata, moleculeInstance as object);

			return moleculeInstance as MoleculeInstance<TReturn>;
		} catch (error) {
			try {
				disposeScope(scope);
			} catch (cleanupError) {
				const aggregated: unknown[] =
					cleanupError instanceof AggregateError
						? [...cleanupError.errors]
						: [cleanupError];
				aggregated.push(error);
				throw new AggregateError(
					aggregated,
					"Molecule setup failed; scope cleanup also encountered errors.",
				);
			}
			throw error;
		}
	}) as MoleculeFactory<TReturn, TProps>;
}

function createMoleculeContext(metadata: MoleculeMetadata): MoleculeContext {
	return {
		get<TReturn extends object, TProps = void>(
			childFactory: MoleculeFactory<TReturn, TProps>,
			...childArgs: MoleculeArgs<TProps>
		): MoleculeInstance<TReturn> {
			if (typeof childFactory !== "function") {
				throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
			}

			const child = childFactory(...childArgs);
			const childMetadata = getMoleculeMetadata(child);

			if (childMetadata === undefined) {
				throw new TypeError(INVALID_MOLECULE_FACTORY_MESSAGE);
			}

			return linkChildMolecule(metadata, childMetadata, child);
		},
	};
}

function resolveProps<TProps>(args: MoleculeArgs<TProps>): TProps {
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
