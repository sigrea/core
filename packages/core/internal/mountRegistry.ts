export type MountJob = () => void;

export interface MountJobRegistry {
	register(job: MountJob): void;
}

const activeRegistryStack: MountJobRegistry[] = [];

export function pushMountJobRegistry(registry: MountJobRegistry): void {
	activeRegistryStack.push(registry);
}

export function popMountJobRegistry(registry: MountJobRegistry): void {
	const current = activeRegistryStack[activeRegistryStack.length - 1];
	if (current !== registry) {
		throw new Error("Mount job registry stack is corrupted.");
	}
	activeRegistryStack.pop();
}

export function getActiveMountJobRegistry(): MountJobRegistry | undefined {
	return activeRegistryStack[activeRegistryStack.length - 1];
}
