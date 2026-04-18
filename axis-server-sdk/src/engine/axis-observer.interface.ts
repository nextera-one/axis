import type { AxisFrame } from "../core/axis-bin";
import type {
  AxisCapsuleRef,
  AxisChainEnvelope,
  AxisChainResult,
  AxisChainStep,
  AxisChainStepResult,
  AxisKeyExchangeRef,
  AxisObserverEvent,
} from "./axis-chain.types";
import type { AxisEffect } from "./intent.router";

export interface AxisObserverContext {
  event: AxisObserverEvent;
  timestamp: number;
  intent?: string;
  chainId?: string;
  stepId?: string;
  handler?: string;
  frame?: AxisFrame;
  envelope?: AxisChainEnvelope;
  step?: AxisChainStep;
  effect?: AxisEffect;
  result?: AxisChainStepResult | AxisChainResult;
  error?: string;
  observerTags?: string[];
  capsule?: AxisCapsuleRef;
  keyExchange?: AxisKeyExchangeRef;
  metadata?: Record<string, unknown>;
}

export interface AxisIntentObserver {
  readonly name: string;
  supports?(context: AxisObserverContext): boolean;
  observe(context: AxisObserverContext): Promise<void> | void;
}

export interface AxisObserverRegistration {
  name: string;
  instance: AxisIntentObserver;
  tags: string[];
  events?: AxisObserverEvent[];
  intents?: string[];
  handlers?: string[];
}