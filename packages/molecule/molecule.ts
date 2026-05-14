import { isPromiseLike } from "../core/internal/async";
import type { MountJobRegistry } from "../core/internal/mountRegistry";
import {
	popMountJobRegistry,
	pushMountJobRegistry,
} from "../core/internal/mountRegistry";
import { createScope, disposeScope, runWithScope } from "../core/scope";

import {
	createMetadata,
	finalizeMetadata,
	popActiveMoleculeMetadata,
	pushActiveMoleculeMetadata,
} from "./internals";
import { createMoleculeProps, readMoleculeProps } from "./props";
import type {
	MoleculeArgs,
	MoleculeFactory,
	MoleculeInstance,
	MoleculePropsInput,
	MoleculeSetupProps,
	ResolvedMoleculeProps,
} from "./types";

const INVALID_SETUP_RETURN_MESSAGE =
	"molecule setup must return an object containing the public API.";
const INVALID_ASYNC_SETUP_RETURN_MESSAGE =
	"molecule setup must return an object synchronously. Async setup is not supported.";

export function molecule<
	TProps extends MoleculePropsInput = void,
	TReturn extends object = object,
>(
	setup: (props: MoleculeSetupProps<TProps>) => TReturn,
): MoleculeFactory<TReturn, TProps> {
	return createMoleculeFactory(setup);
}

function createMoleculeFactory<
	TReturn extends object,
	TProps extends MoleculePropsInput,
>(
	setup: (props: MoleculeSetupProps<TProps>) => TReturn,
): MoleculeFactory<TReturn, TProps> {
	return ((...args: MoleculeArgs<TProps>) => {
		const propsStore = createMoleculeProps(resolveProps(args));
		const scope = createScope();
		const metadata = createMetadata(scope, propsStore);
		const mountRegistry: MountJobRegistry = {
			register(job) {
				metadata.mountJobs.push(job);
			},
		};

		try {
			const moleculeInstance = runWithScope(scope, () => {
				pushActiveMoleculeMetadata(metadata);
				pushMountJobRegistry(mountRegistry);
				try {
					const instance = ensureSetupResult(
						setup(readMoleculeProps(propsStore)),
					);
					return instance;
				} finally {
					popMountJobRegistry(mountRegistry);
					popActiveMoleculeMetadata(metadata);
				}
			});

			finalizeMetadata(metadata, moleculeInstance as object);

			return moleculeInstance as MoleculeInstance<TReturn, TProps>;
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

function resolveProps<TProps extends MoleculePropsInput>(
	args: MoleculeArgs<TProps>,
): ResolvedMoleculeProps<TProps> {
	if (args.length === 0 || args[0] === undefined) {
		return {} as ResolvedMoleculeProps<TProps>;
	}
	return args[0] as ResolvedMoleculeProps<TProps>;
}

function ensureSetupResult<TReturn extends object>(
	value: TReturn | null | undefined,
): TReturn {
	if (isPromiseLike(value)) {
		throw new TypeError(INVALID_ASYNC_SETUP_RETURN_MESSAGE);
	}
	if (value === null || typeof value !== "object") {
		throw new TypeError(INVALID_SETUP_RETURN_MESSAGE);
	}

	return value;
}
