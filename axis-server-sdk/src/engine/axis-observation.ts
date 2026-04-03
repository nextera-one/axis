import { randomBytes } from 'crypto';

/* ─── Stage ─── */

export interface ObservationStage {
  name: string;
  status: 'ok' | 'fail' | 'skip';
  startMs: number;
  endMs?: number;
  durationMs?: number;
  reason?: string;
  code?: string;
}

/* ─── Sensor Record ─── */

export interface ObservationSensor {
  name: string;
  allowed: boolean;
  riskScore: number;
  durationMs: number;
  reasons: string[];
  code?: string;
}

/* ─── Observation (the execution witness) ─── */

export interface AxisObservation {
  /** Correlation ID (hex) */
  id: string;
  /** High-res start timestamp */
  startMs: number;
  /** Transport origin */
  transport: 'http' | 'ws';
  /** Client IP */
  ip?: string;
  /** Resolved intent */
  intent?: string;
  /** Actor ID (hex) */
  actorId?: string;
  /** Capsule ID */
  capsuleId?: string;

  /** Pipeline stages with timing */
  stages: ObservationStage[];
  /** Individual sensor decisions */
  sensors: ObservationSensor[];

  /** Final decision */
  decision?: 'ALLOW' | 'DENY';
  /** Machine-readable result code */
  resultCode?: string;
  /** HTTP status code */
  statusCode?: number;

  /** End timestamp */
  endMs?: number;
  /** Total duration */
  durationMs?: number;

  /** Extensible facts for downstream (receipt builder, audit, etc.) */
  facts: Record<string, unknown>;
}

/* ─── Factory ─── */

export function createObservation(
  transport: 'http' | 'ws',
  ip?: string,
): AxisObservation {
  return {
    id: randomBytes(16).toString('hex'),
    startMs: Date.now(),
    transport,
    ip,
    stages: [],
    sensors: [],
    facts: {},
  };
}

/* ─── Stage helpers ─── */

export function startStage(
  obs: AxisObservation,
  name: string,
): ObservationStage {
  const stage: ObservationStage = { name, status: 'ok', startMs: Date.now() };
  obs.stages.push(stage);
  return stage;
}

export function endStage(
  stage: ObservationStage,
  status: 'ok' | 'fail' | 'skip' = 'ok',
  reason?: string,
  code?: string,
): void {
  stage.endMs = Date.now();
  stage.durationMs = stage.endMs - stage.startMs;
  stage.status = status;
  if (reason) stage.reason = reason;
  if (code) stage.code = code;
}

/* ─── Sensor recording (called by chain service) ─── */

export function recordSensor(
  obs: AxisObservation,
  name: string,
  allowed: boolean,
  riskScore: number,
  durationMs: number,
  reasons: string[],
  code?: string,
): void {
  obs.sensors.push({ name, allowed, riskScore, durationMs, reasons, code });
}

/* ─── Finalize ─── */

export function finalizeObservation(
  obs: AxisObservation,
  decision: 'ALLOW' | 'DENY',
  statusCode: number,
  resultCode?: string,
): void {
  obs.endMs = Date.now();
  obs.durationMs = obs.endMs - obs.startMs;
  obs.decision = decision;
  obs.statusCode = statusCode;
  if (resultCode) obs.resultCode = resultCode;
}
