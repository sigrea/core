let batchDepth = 0;

export function incrementBatchDepth(): void {
	batchDepth += 1;
}

export function decrementBatchDepth(): number {
	if (batchDepth === 0) {
		return 0;
	}

	batchDepth -= 1;
	return batchDepth;
}

export function getBatchDepth(): number {
	return batchDepth;
}
