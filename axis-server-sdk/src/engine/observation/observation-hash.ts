import { createHash } from 'crypto';

import { AxisObservation } from '../axis-observation';
import { stableJsonStringify } from './stable-json';

/**
 * Witness summary — a compact proof-of-observation payload
 * signed by the node that observed the execution.
 */
export interface ObservationWitnessSummary {
  intent?: string;
  actorId?: string;
  decision?: string;
  statusCode?: number;
  durationMs?: number;
  sensorCount: number;
  stageCount: number;
}

/**
 * Unsigned witness artifact — everything except the signature.
 * The backend adds `kid`, `sig`, and `alg` using its keyring.
 */
export interface UnsignedObservationWitness {
  v: 1;
  observationId: string;
  payloadHash: string;
  sealedAt: number;
  summary: ObservationWitnessSummary;
}

/**
 * Build the canonical JSON representation of an observation.
 *
 * Only includes structurally meaningful fields (no transient state).
 * Keys are sorted deterministically via `stableJsonStringify` so that
 * the same observation always produces the same string.
 */
export function canonicalizeObservation(obs: AxisObservation): string {
  const obj: Record<string, unknown> = {
    id: obs.id,
    startMs: obs.startMs,
    endMs: obs.endMs,
    transport: obs.transport,
    ip: obs.ip,
    intent: obs.intent,
    actorId: obs.actorId,
    capsuleId: obs.capsuleId,
    decision: obs.decision,
    resultCode: obs.resultCode,
    statusCode: obs.statusCode,
    durationMs: obs.durationMs,
    stages: obs.stages.map((s) => ({
      name: s.name,
      status: s.status,
      startMs: s.startMs,
      endMs: s.endMs,
      durationMs: s.durationMs,
      reason: s.reason,
      code: s.code,
    })),
    sensors: obs.sensors.map((s) => ({
      name: s.name,
      allowed: s.allowed,
      riskScore: s.riskScore,
      durationMs: s.durationMs,
      reasons: s.reasons,
      code: s.code,
    })),
  };

  return stableJsonStringify(obj);
}

/**
 * SHA-256 hash of the canonical observation payload.
 */
export function hashObservation(obs: AxisObservation): string {
  const canonical = canonicalizeObservation(obs);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Build an unsigned witness from a finalized observation.
 *
 * Returns `null` if the observation has not been finalized
 * (no `decision` or `endMs`).
 *
 * The caller (backend WitnessBuilder) adds `kid`, `sig`, `alg`
 * using its keyring.
 */
export function buildUnsignedWitness(
  obs: AxisObservation,
): UnsignedObservationWitness | null {
  if (!obs.decision || !obs.endMs) {
    return null;
  }

  return {
    v: 1,
    observationId: obs.id,
    payloadHash: hashObservation(obs),
    sealedAt: Date.now(),
    summary: {
      intent: obs.intent,
      actorId: obs.actorId,
      decision: obs.decision,
      statusCode: obs.statusCode,
      durationMs: obs.durationMs,
      sensorCount: obs.sensors.length,
      stageCount: obs.stages.length,
    },
  };
}
