import { createScope, disposeScope, runWithScope } from "../core/scope";

import {
	createMetadata,
	finalizeMetadata,
	popActiveMoleculeMetadata,
	pushActiveMoleculeMetadata,
} from "./internals";
import type {
	MoleculeArgs,
	MoleculeFactory,
	MoleculeInstance,
} from "./types";

const INVALID_SETUP_RETURN_MESSAGE =
	"molecule setup must return an object containing the public API.";

export function molecule<TProps = void, TReturn extends object = object>(
	setup: (props: TProps) => TReturn,
): MoleculeFactory<TReturn, TProps> {
	return createMoleculeFactory(setup);
}

function createMoleculeFactory<TReturn extends object, TProps>(
	setup: (props: TProps) => TReturn,
): MoleculeFactory<TReturn, TProps> {
	return ((...args: MoleculeArgs<TProps>) => {
		const props = resolveProps(args);
		const scope = createScope();
		const metadata = createMetadata(scope);

		try {
			const moleculeInstance = runWithScope(scope, () => {
				pushActiveMoleculeMetadata(metadata);
				try {
					const instance = ensureSetupResult(setup(props));
					return instance;
				} finally {
					popActiveMoleculeMetadata(metadata);
				}
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
