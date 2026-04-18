export type AxisExecutionMode = 'strict' | 'parallel' | 'best_effort' | 'atomic';

export type AxisObserverEvent =
  | 'intent.received'
  | 'intent.completed'
  | 'intent.failed'
  | 'chain.received'
  | 'chain.admitted'
  | 'chain.completed'
  | 'chain.failed'
  | 'chain.partial'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.blocked'
  | 'step.skipped'
  | 'signature.verified'
  | 'decryption.succeeded'
  | 'sensor.passed'
  | 'sensor.failed'
  | 'handler.completed'
  | 'proof.recorded';

export interface AxisCapsuleRef {
  capsuleId?: string;
  scope?: string | string[];
  scopeMode?: 'chain' | 'step' | 'chain+step';
  proofRequired?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AxisKeyExchangeRef {
  profile?: string;
  sessionId?: string;
  clientKid?: string;
  serverKid?: string;
  algorithm?: string;
  derivedKeyRef?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AxisIntentEnvelope<TPayload = unknown> {
  intent: string;
  handler?: string;
  payload: TPayload;
  capsule?: AxisCapsuleRef;
  keyExchange?: AxisKeyExchangeRef;
  observerTags?: string[];
  proofRequired?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AxisChainStep<TInput = unknown> {
  stepId: string;
  intent: string;
  handler?: string;
  input?: TInput;
  dependsOn?: string[];
  onSuccess?: string[];
  onFailure?: string[];
  capsuleScope?: string | string[];
  observerTags?: string[];
  proofRequired?: boolean;
  keyExchange?: AxisKeyExchangeRef;
  metadata?: Record<string, unknown>;
}

export interface AxisChainEncryption {
  enabled?: boolean;
  profile?: string;
  keyExchange?: AxisKeyExchangeRef;
}

export interface AxisChainEnvelope<TInput = unknown> {
  chainId: string;
  subject?: string;
  issuer?: string;
  issuedAtTps?: string | number;
  expiresAtTps?: string | number;
  mode: AxisExecutionMode;
  signature?: string;
  encryption?: AxisChainEncryption;
  capsule?: AxisCapsuleRef;
  keyExchange?: AxisKeyExchangeRef;
  observerTags?: string[];
  dynamic?: boolean;
  metadata?: Record<string, unknown>;
  steps: Array<AxisChainStep<TInput>>;
}

export interface AxisChainRequest<
  TInput = unknown,
  TCapsule = Record<string, unknown>,
> {
  envelope: AxisChainEnvelope<TInput>;
  capsule?: TCapsule;
  actorId?: string;
}

export type AxisChainStepStatus =
  | 'SUCCEEDED'
  | 'FAILED'
  | 'BLOCKED'
  | 'SKIPPED';

export interface AxisChainStepResult<TOutput = unknown> {
  stepId: string;
  intent: string;
  status: AxisChainStepStatus;
  effect?: string;
  output?: TOutput;
  error?: string;
  dependsOn?: string[];
  startedAt: number;
  finishedAt: number;
  proofHash?: string;
  observerTags?: string[];
  metadata?: Record<string, unknown>;
}

export type AxisChainStatus = 'SUCCEEDED' | 'FAILED' | 'PARTIAL';

export interface AxisChainResult<TOutput = unknown> {
  chainId: string;
  mode: AxisExecutionMode;
  status: AxisChainStatus;
  completedSteps: number;
  failedSteps: number;
  blockedSteps: number;
  skippedSteps: number;
  startedAt: number;
  finishedAt: number;
  results: Array<AxisChainStepResult<TOutput>>;
  rollback?: {
    supported: boolean;
    attempted: boolean;
    reason?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface ChainOptions {
  mode?: AxisExecutionMode;
  allowPartial?: boolean;
  dynamic?: boolean;
  proofRequired?: boolean;
  capsuleScope?: string | string[];
  observerTags?: string[];
  keyExchangeRequired?: boolean;
}

export interface RegisteredChainConfig extends ChainOptions {
  enabled: boolean;
}