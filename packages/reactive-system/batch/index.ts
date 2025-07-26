/**
 * Batch Depth Management Module
 *
 * This module manages batch operation depth for the reactive system.
 * Batching allows multiple state changes to be grouped together, deferring
 * effect notifications until all changes within the batch are complete.
 *
 * This prevents intermediate states from triggering effects and improves
 * performance when making multiple related changes. The batch depth tracks
 * nested batch operations, ensuring effects only run when all batches complete.
 */

let batchDepth = 0;

export function incrementBatchDepth(): void {
  ++batchDepth;
}

export function decrementBatchDepth(): number {
  return --batchDepth;
}

export function getBatchDepth(): number {
  return batchDepth;
}
