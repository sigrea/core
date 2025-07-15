import {
  decrementBatchDepth,
  incrementBatchDepth,
  processEffectNotifications,
} from "../reactive-system";

export function startBatch(): void {
  incrementBatchDepth();
}

export function endBatch(): void {
  if (!decrementBatchDepth()) {
    processEffectNotifications();
  }
}
