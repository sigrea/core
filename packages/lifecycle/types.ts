// biome-ignore lint/suspicious/noConfusingVoidType: Mount callbacks must allow missing cleanup returns.
export type MountCallback = () => void | (() => void);

export type MountCleanup = ReturnType<MountCallback>;

export type UnmountCallback = () => void;

export interface LifecycleCapable {
	onMount(callback: MountCallback): () => void;
	readonly _listenerCount: number;
	readonly _isMounted: boolean;
}

export function isLifecycleCapable(value: unknown): value is LifecycleCapable {
	if (value === null || typeof value !== "object") {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.onMount === "function" &&
		typeof candidate._listenerCount === "number" &&
		typeof candidate._isMounted === "boolean"
	);
}
