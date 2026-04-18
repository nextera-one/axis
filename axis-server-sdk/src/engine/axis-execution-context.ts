import type { AxisFrame } from "../core/axis-bin";

import type { AxisCapsuleRef, AxisChainEnvelope, AxisChainStep } from "./axis-chain.types";

export const AXIS_EXECUTION_CONTEXT_KEY = Symbol.for("axis.executionContext");

export interface AxisExecutionContext {
  metaIntent?: "INTENT.EXEC" | "CHAIN.EXEC";
  actorId?: string;
  inlineCapsule?: Record<string, unknown>;
  capsuleRef?: AxisCapsuleRef;
  chainEnvelope?: AxisChainEnvelope;
  chainStep?: AxisChainStep;
}

type FrameLike = Partial<AxisFrame> & {
  [AXIS_EXECUTION_CONTEXT_KEY]?: AxisExecutionContext;
};

export function getAxisExecutionContext(
  frame?: Partial<AxisFrame>,
): AxisExecutionContext | undefined {
  return (frame as FrameLike | undefined)?.[AXIS_EXECUTION_CONTEXT_KEY];
}

export function withAxisExecutionContext<T extends object>(
  target: T,
  context: AxisExecutionContext,
): T {
  Object.defineProperty(target, AXIS_EXECUTION_CONTEXT_KEY, {
    value: context,
    writable: true,
    configurable: true,
    enumerable: false,
  });

  return target;
}

export function mergeAxisExecutionContext(
  base?: AxisExecutionContext,
  override?: AxisExecutionContext,
): AxisExecutionContext | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    ...base,
    ...override,
    capsuleRef: {
      ...(base?.capsuleRef || {}),
      ...(override?.capsuleRef || {}),
    },
  };
}