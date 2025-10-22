import { getLogicMetadata } from "./internals";
import type { LogicInstance } from "./types";

export function isLogicInstance<T extends object>(
	value: unknown,
): value is LogicInstance<T> {
	return getLogicMetadata(value) !== undefined;
}
