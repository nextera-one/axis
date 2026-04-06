import { AxisObservation } from '../axis-observation';

export interface ObservationQueueMessage {
  v: 1;
  observation: AxisObservation;
  attempts: number;
  firstEnqueuedAt: number;
  lastEnqueuedAt: number;
  sourceNodeId: string;
  lastError?: string;
}

export interface ObservationQueueConfig {
  enabled: boolean;
  workerEnabled: boolean;
  streamKey: string;
  deadLetterStreamKey: string;
  groupName: string;
  consumerName: string;
  readBlockMs: number;
  readBatchSize: number;
  reclaimIdleMs: number;
  reclaimBatchSize: number;
  maxRetries: number;
  maxStreamLength: number;
  workerConcurrency: number;
}
