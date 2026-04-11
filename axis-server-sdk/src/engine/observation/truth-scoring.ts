/**
 * Observer Truth Scoring
 *
 * Extends the AxisObservation model with truth verification:
 * - Expected vs actual outcome comparison
 * - Truth status classification
 * - Anomaly detection
 * - Deed confirmation
 *
 * This transforms the Observer from a "logger" into a "verifier" —
 * the moment where execution becomes witnessed truth.
 */

import type { AxisObservation, ObservationStage } from '../axis-observation';

// ────────────────────────────────────────────────────────────────────────────
// Truth Status
// ────────────────────────────────────────────────────────────────────────────

export type TruthStatus =
  | 'confirmed'   // Execution matched expected outcome exactly
  | 'partial'     // Some expectations met, some could not be verified
  | 'uncertain'   // Unable to determine correctness
  | 'failed'      // Execution produced wrong or error result
  | 'disputed';   // Result contradicts expected state

// ────────────────────────────────────────────────────────────────────────────
// Expected Outcome
// ────────────────────────────────────────────────────────────────────────────

export interface ExpectedOutcome {
  /** Expected final decision */
  decision?: 'ALLOW' | 'DENY';
  /** Expected effect label from handler */
  effect?: string;
  /** Expected status code */
  statusCode?: number;
  /** Whether the handler should succeed */
  ok?: boolean;
  /** Expected state changes (key-value) */
  stateChanges?: Record<string, unknown>;
  /** Maximum acceptable duration in ms */
  maxDurationMs?: number;
  /** Minimum required sensor count */
  minSensorsPassed?: number;
  /** custom assertions: field path → expected value */
  assertions?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Anomaly
// ────────────────────────────────────────────────────────────────────────────

export type AnomalyLevel = 'info' | 'warning' | 'critical';

export interface Anomaly {
  code: string;
  level: AnomalyLevel;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Truth Verdict
// ────────────────────────────────────────────────────────────────────────────

export interface TruthVerdict {
  /** Overall truth status */
  status: TruthStatus;
  /** Confidence score 0.0 – 1.0 */
  confidence: number;
  /** Detected anomalies */
  anomalies: Anomaly[];
  /** Number of checks that passed */
  passedChecks: number;
  /** Total number of checks performed */
  totalChecks: number;
  /** Timestamp of verdict */
  verifiedAt: number;
  /** Whether this observation constitutes a confirmed deed */
  isDeed: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Scoring Logic
// ────────────────────────────────────────────────────────────────────────────

/**
 * Score an observation against an expected outcome.
 * If no expectedOutcome is provided, performs structural verification only.
 */
export function scoreTruth(
  obs: AxisObservation,
  expected?: ExpectedOutcome,
): TruthVerdict {
  const anomalies: Anomaly[] = [];
  let passedChecks = 0;
  let totalChecks = 0;

  // ── Structural checks (always run) ──

  // 1. Observation must be finalized
  totalChecks++;
  if (obs.endMs && obs.decision) {
    passedChecks++;
  } else {
    anomalies.push({
      code: 'OBS_NOT_FINALIZED',
      level: 'critical',
      message: 'Observation was not finalized',
    });
  }

  // 2. Must have at least one stage
  totalChecks++;
  if (obs.stages.length > 0) {
    passedChecks++;
  } else {
    anomalies.push({
      code: 'OBS_NO_STAGES',
      level: 'warning',
      message: 'Observation has no execution stages',
    });
  }

  // 3. No failed stages (unless decision is DENY)
  totalChecks++;
  const failedStages = obs.stages.filter((s) => s.status === 'fail');
  if (failedStages.length === 0 || obs.decision === 'DENY') {
    passedChecks++;
  } else {
    for (const stage of failedStages) {
      anomalies.push({
        code: 'STAGE_FAILED',
        level: 'warning',
        message: `Stage '${stage.name}' failed: ${stage.reason ?? 'unknown'}`,
        field: `stages.${stage.name}`,
      });
    }
  }

  // 4. All sensors should have valid timing
  totalChecks++;
  const invalidSensors = obs.sensors.filter((s) => s.durationMs < 0);
  if (invalidSensors.length === 0) {
    passedChecks++;
  } else {
    anomalies.push({
      code: 'SENSOR_INVALID_TIMING',
      level: 'warning',
      message: `${invalidSensors.length} sensor(s) have negative duration`,
    });
  }

  // 5. Duration sanity
  totalChecks++;
  if (obs.durationMs !== undefined && obs.durationMs >= 0 && obs.durationMs < 300_000) {
    passedChecks++;
  } else {
    anomalies.push({
      code: 'OBS_DURATION_ANOMALY',
      level: 'warning',
      message: `Observation duration ${obs.durationMs}ms is suspicious`,
      actual: obs.durationMs,
    });
  }

  // ── Expected outcome checks (if provided) ──

  if (expected) {
    // Decision match
    if (expected.decision !== undefined) {
      totalChecks++;
      if (obs.decision === expected.decision) {
        passedChecks++;
      } else {
        anomalies.push({
          code: 'DECISION_MISMATCH',
          level: 'critical',
          message: `Expected decision '${expected.decision}', got '${obs.decision}'`,
          field: 'decision',
          expected: expected.decision,
          actual: obs.decision,
        });
      }
    }

    // Status code match
    if (expected.statusCode !== undefined) {
      totalChecks++;
      if (obs.statusCode === expected.statusCode) {
        passedChecks++;
      } else {
        anomalies.push({
          code: 'STATUS_MISMATCH',
          level: 'warning',
          message: `Expected status ${expected.statusCode}, got ${obs.statusCode}`,
          field: 'statusCode',
          expected: expected.statusCode,
          actual: obs.statusCode,
        });
      }
    }

    // Effect match
    if (expected.effect !== undefined) {
      totalChecks++;
      if (obs.resultCode === expected.effect || obs.facts?.effect === expected.effect) {
        passedChecks++;
      } else {
        anomalies.push({
          code: 'EFFECT_MISMATCH',
          level: 'warning',
          message: `Expected effect '${expected.effect}', got '${obs.resultCode}'`,
          field: 'resultCode',
          expected: expected.effect,
          actual: obs.resultCode,
        });
      }
    }

    // Max duration
    if (expected.maxDurationMs !== undefined) {
      totalChecks++;
      if (obs.durationMs !== undefined && obs.durationMs <= expected.maxDurationMs) {
        passedChecks++;
      } else {
        anomalies.push({
          code: 'DURATION_EXCEEDED',
          level: 'warning',
          message: `Execution took ${obs.durationMs}ms, max allowed ${expected.maxDurationMs}ms`,
          field: 'durationMs',
          expected: expected.maxDurationMs,
          actual: obs.durationMs,
        });
      }
    }

    // Min sensors passed
    if (expected.minSensorsPassed !== undefined) {
      totalChecks++;
      const passed = obs.sensors.filter((s) => s.allowed).length;
      if (passed >= expected.minSensorsPassed) {
        passedChecks++;
      } else {
        anomalies.push({
          code: 'INSUFFICIENT_SENSORS',
          level: 'warning',
          message: `Only ${passed} sensors passed, minimum required ${expected.minSensorsPassed}`,
          field: 'sensors',
          expected: expected.minSensorsPassed,
          actual: passed,
        });
      }
    }

    // Custom assertions against facts
    if (expected.assertions) {
      for (const [key, expectedValue] of Object.entries(expected.assertions)) {
        totalChecks++;
        const actualValue = obs.facts[key];
        if (deepEqual(actualValue, expectedValue)) {
          passedChecks++;
        } else {
          anomalies.push({
            code: 'ASSERTION_FAILED',
            level: 'warning',
            message: `Assertion failed for facts.${key}`,
            field: `facts.${key}`,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      }
    }
  }

  // ── Compute verdict ──

  const confidence = totalChecks > 0 ? passedChecks / totalChecks : 0;
  const hasCritical = anomalies.some((a) => a.level === 'critical');
  const status = computeTruthStatus(confidence, hasCritical, anomalies.length);
  const isDeed = status === 'confirmed' || (status === 'partial' && !hasCritical);

  return {
    status,
    confidence,
    anomalies,
    passedChecks,
    totalChecks,
    verifiedAt: Date.now(),
    isDeed,
  };
}

function computeTruthStatus(
  confidence: number,
  hasCritical: boolean,
  anomalyCount: number,
): TruthStatus {
  if (hasCritical) return 'failed';
  if (confidence === 1.0) return 'confirmed';
  if (confidence >= 0.8) return 'partial';
  if (confidence >= 0.5) return 'uncertain';
  return 'disputed';
}

// ────────────────────────────────────────────────────────────────────────────
// Attach truth to observation
// ────────────────────────────────────────────────────────────────────────────

export interface ObservedDeed {
  observation: AxisObservation;
  verdict: TruthVerdict;
}

/**
 * Verify an observation and produce an ObservedDeed.
 * This is the moment where execution becomes accountable reality.
 */
export function verifyObservation(
  obs: AxisObservation,
  expected?: ExpectedOutcome,
): ObservedDeed {
  const verdict = scoreTruth(obs, expected);
  return { observation: obs, verdict };
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return String(a) === String(b);

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}
