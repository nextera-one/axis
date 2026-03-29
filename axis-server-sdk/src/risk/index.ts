/**
 * AXIS Risk Signal Types
 *
 * Protocol-level types for risk evaluation and signalling.
 * Used by sensors, risk gates, and anomaly detectors.
 */

/**
 * A discrete risk signal emitted by a detector or sensor.
 * Signals are aggregated by the risk gate to produce a final RiskEvaluation.
 */
export interface RiskSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: any;
  message: string;
}

/**
 * Granular risk gate decision outcomes.
 * More expressive than a binary ALLOW/DENY — covers step-up and witness flows.
 */
export enum RiskDecision {
  ALLOW = 'ALLOW',
  THROTTLE = 'THROTTLE',
  STEP_UP = 'STEP_UP',
  WITNESS = 'WITNESS',
  DENY = 'DENY',
}

/**
 * The result of a risk gate evaluation over a set of signals.
 */
export interface RiskEvaluation {
  decision: RiskDecision;
  reason?: string;
  retryAfterMs?: number;
  /** Confidence score in range [0, 1]. */
  confidence: number;
  signals: RiskSignal[];
}
