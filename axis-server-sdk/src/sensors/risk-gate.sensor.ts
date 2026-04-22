
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import type { RiskSignal, RiskEvaluation } from '../risk';
import { RiskDecision } from '../risk';
import type { AxisSensor, SensorDecision, SensorInput } from '../sensor/axis-sensor';

/**
 * Risk signal collector function.
 * Implementations gather signals from the request context
 * (anomaly scores, geo risk, velocity checks, device fingerprint, etc.)
 */
export type RiskSignalCollector = (
  input: SensorInput,
) => Promise<RiskSignal[]> | RiskSignal[];

/**
 * Configuration for the Risk Gate Sensor.
 */
export interface RiskGateSensorOptions {
  /**
   * One or more collectors that produce RiskSignals.
   * All collectors run and their signals are aggregated.
   */
  collectors: RiskSignalCollector[];

  /**
   * Risk score threshold at which the sensor denies (0–100).
   * Defaults to 75.
   */
  denyThreshold?: number;

  /**
   * Risk score threshold at which the sensor flags but allows (0–100).
   * Defaults to 40.
   */
  flagThreshold?: number;
}

/** Map severity to a numeric weight */
const SEVERITY_WEIGHT: Record<RiskSignal['severity'], number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 100,
};

/**
 * Risk Gate Sensor — Aggregates risk signals into a gate decision.
 *
 * Collects signals from pluggable collectors, computes a weighted
 * aggregate risk score, and translates RiskDecision into a
 * SensorDecision the chain can enforce.
 *
 * Runs in the BUSINESS band so all identity, policy, and content
 * sensors have already contributed their metadata.
 */
@Sensor()
export class RiskGateSensor implements AxisSensor {
  readonly name = 'RiskGateSensor';
  readonly order = BAND.BUSINESS + 10;

  private readonly collectors: RiskSignalCollector[];
  private readonly denyThreshold: number;
  private readonly flagThreshold: number;

  constructor(options: RiskGateSensorOptions) {
    this.collectors = options.collectors;
    this.denyThreshold = options.denyThreshold ?? 75;
    this.flagThreshold = options.flagThreshold ?? 40;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    // Collect all signals in parallel
    const results = await Promise.all(
      this.collectors.map((c) => c(input)),
    );
    const signals: RiskSignal[] = results.flat();

    // Aggregate: weighted mean of severity scores, capped at 100
    let totalWeight = 0;
    let weightedSum = 0;
    for (const signal of signals) {
      const w = SEVERITY_WEIGHT[signal.severity];
      totalWeight += 1;
      weightedSum += w;
    }
    const aggregateScore =
      totalWeight > 0 ? Math.min(100, Math.round(weightedSum / totalWeight)) : 0;

    // Evaluate
    const evaluation = this.evaluate(aggregateScore, signals);

    // Store evaluation in metadata for downstream consumers
    input.metadata = {
      ...(input.metadata ?? {}),
      riskEvaluation: evaluation,
    };

    if (evaluation.decision === RiskDecision.DENY) {
      return {
        allow: false,
        riskScore: aggregateScore,
        reasons: signals.map((s) => s.message),
        code: 'RISK_GATE_DENY',
        tags: { riskDecision: evaluation.decision, signalCount: signals.length },
      };
    }

    if (evaluation.decision === RiskDecision.THROTTLE) {
      return {
        allow: false,
        riskScore: aggregateScore,
        reasons: signals.map((s) => s.message),
        code: 'RISK_GATE_THROTTLE',
        retryAfterMs: evaluation.retryAfterMs,
        tags: { riskDecision: evaluation.decision, signalCount: signals.length },
      };
    }

    // ALLOW, STEP_UP, WITNESS, FLAG — allow but propagate score
    return {
      allow: true,
      riskScore: aggregateScore,
      reasons: signals
        .filter((s) => s.severity === 'medium' || s.severity === 'high')
        .map((s) => s.message),
      tags: {
        riskDecision: evaluation.decision,
        signalCount: signals.length,
      },
    };
  }

  private evaluate(
    score: number,
    signals: RiskSignal[],
  ): RiskEvaluation {
    // Any critical signal → immediate DENY
    const hasCritical = signals.some((s) => s.severity === 'critical');
    if (hasCritical) {
      return {
        decision: RiskDecision.DENY,
        reason: 'Critical risk signal detected',
        confidence: 1,
        signals,
      };
    }

    if (score >= this.denyThreshold) {
      return {
        decision: RiskDecision.DENY,
        reason: `Aggregate risk score ${score} exceeds deny threshold ${this.denyThreshold}`,
        confidence: score / 100,
        signals,
      };
    }

    if (score >= this.flagThreshold) {
      return {
        decision: RiskDecision.STEP_UP,
        reason: `Aggregate risk score ${score} exceeds flag threshold ${this.flagThreshold}`,
        confidence: score / 100,
        signals,
      };
    }

    return {
      decision: RiskDecision.ALLOW,
      confidence: 1 - score / 100,
      signals,
    };
  }
}
