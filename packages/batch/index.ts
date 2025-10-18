import {
	decrementBatchDepth,
	getBatchDepth,
	incrementBatchDepth,
	processEffectNotifications,
} from "../reactive-system";

export function startBatch(): void {
	incrementBatchDepth();
}

export function endBatch(): void {
	if (getBatchDepth() <= 0) {
		throw new Error("endBatch called without a matching startBatch()");
	}

	if (decrementBatchDepth() === 0) {
		processEffectNotifications();
	}
}

export function batch<T>(fn: () => T): T {
	startBatch();
	try {
		return fn();
	} finally {
		endBatch();
	}
}
