let batchDepth = 0;

export function incrementBatchDepth(): void {
	batchDepth += 1;
}

export function decrementBatchDepth(): number {
	batchDepth -= 1;
	return batchDepth;
}

export function getBatchDepth(): number {
	return batchDepth;
}
