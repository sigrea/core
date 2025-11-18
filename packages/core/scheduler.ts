const resolvedPromise = Promise.resolve();

let pendingFlushJobs = 0;
let pendingFlushPromise: Promise<void> | undefined;
let resolvePendingFlush: (() => void) | undefined;

const enqueueMicrotask: (cb: () => void) => void =
	typeof queueMicrotask === "function"
		? queueMicrotask
		: (cb: () => void) => {
				resolvedPromise.then(cb);
			};

function startTracking(): void {
	if (pendingFlushJobs === 0) {
		pendingFlushPromise = new Promise((resolve) => {
			resolvePendingFlush = resolve;
		});
	}
	pendingFlushJobs += 1;
}

function endTracking(): void {
	pendingFlushJobs -= 1;
	if (pendingFlushJobs === 0 && resolvePendingFlush !== undefined) {
		resolvePendingFlush();
		resolvePendingFlush = undefined;
		pendingFlushPromise = undefined;
	}
}

function runTrackedJob(flush: () => void): void {
	try {
		flush();
	} finally {
		endTracking();
	}
}

export function schedulePreFlush(flush: () => void): void {
	startTracking();
	enqueueMicrotask(() => {
		runTrackedJob(flush);
	});
}

export function schedulePostFlush(flush: () => void): void {
	startTracking();
	enqueueMicrotask(() => {
		enqueueMicrotask(() => {
			runTrackedJob(flush);
		});
	});
}

export function awaitSchedulerFlush(): Promise<void> {
	return pendingFlushPromise ?? resolvedPromise;
}
