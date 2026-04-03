import { Injectable, Logger } from '@nestjs/common';

import { SensorRegistry } from '../engine/registry/sensor.registry';
import {
  SensorDecision,
  SensorInput,
  normalizeSensorDecision,
  AxisSensor,
} from '../sensor/axis-sensor';
import { recordSensor, AxisObservation } from '../engine/axis-observation';

export { SensorInput, SensorDecision }; // Re-export for convenience

/**
 * The consolidated result of a sensor chain evaluation.
 *
 * @interface ChainResult
 */
export interface ChainResult {
  /** True if all compulsory sensors allowed the request */
  allowed: boolean;
  /** The total risk score delta accumulated across all sensors */
  scoreDelta: number;
  /** Suggested HTTP status code for the response */
  statusCode: number;
  /** Binary or text body describing the reason for denial or containing the response */
  body?: string | Buffer | Uint8Array;
  /** Optional headers (TLVs) to be returned to the client */
  headers?: Map<number, Uint8Array>;
}

/**
 * AxisSensorChain
 *
 * Orchestrates the execution of a series of security sensors against an AXIS request.
 * Sensors are retrieved from the SensorRegistry and executed in order.
 *
 * **Decision Handling:**
 * - `DENY`: Immediately stops execution and returns a failure result.
 * - `THROTTLE`: Immediately stops execution and requests client retry.
 * - `FLAG`: Accumulates a risk score delta and continues.
 * - `ALLOW`: Continues to the next sensor.
 *
 * @class AxisSensorChain
 * @injectable
 */
@Injectable()
export class AxisSensorChainService {
  constructor(private readonly registry: SensorRegistry) {}

  /**
   * Evaluate all applicable sensors based on phase.
   */
  async evaluate(
    input: SensorInput,
    phase: 'PRE_DECODE' | 'POST_DECODE' | 'BOTH' = 'POST_DECODE',
    baseDecision?: SensorDecision,
  ): Promise<SensorDecision> {
    if (phase === 'PRE_DECODE') {
      return this.evaluateSensors(this.registry.getPreDecodeSensors(), input);
    }

    if (phase === 'BOTH') {
      const rawPreResult = await this.evaluateSensors(
        this.registry.getPreDecodeSensors(),
        input,
      );
      const preResult = normalizeSensorDecision(rawPreResult);
      if (!preResult.allow) return rawPreResult;
      return this.evaluateSensors(
        this.registry.getPostDecodeSensors(),
        input,
        rawPreResult,
      );
    }

    // Default: POST_DECODE only
    return this.evaluateSensors(
      this.registry.getPostDecodeSensors(),
      input,
      baseDecision,
    );
  }

  /** Run only pre-decode sensors. */
  async evaluatePre(input: SensorInput): Promise<SensorDecision> {
    return this.evaluateSensors(this.registry.getPreDecodeSensors(), input);
  }

  /** Run only post-decode sensors. */
  async evaluatePost(
    input: SensorInput,
    baseDecision?: SensorDecision,
  ): Promise<SensorDecision> {
    return this.evaluateSensors(
      this.registry.getPostDecodeSensors(),
      input,
      baseDecision,
    );
  }

  private async evaluateSensors(
    sensors: AxisSensor[],
    input: SensorInput,
    baseDecision?: SensorDecision,
  ): Promise<SensorDecision> {
    // Filter to relevant sensors
    const relevantSensors = sensors.filter(
      (s) => !s.supports || s.supports(input),
    );

    // Normalize baseDecision if provided
    const normalizedBase = baseDecision
      ? normalizeSensorDecision(baseDecision)
      : undefined;

    let riskScore = normalizedBase?.riskScore ?? 0;
    const reasons: string[] = normalizedBase?.reasons
      ? [...normalizedBase.reasons]
      : [];
    const tags: Record<string, any> = normalizedBase?.tags
      ? { ...normalizedBase.tags }
      : {};
    let expSecondsMax = normalizedBase?.tighten?.expSecondsMax;
    let constraintsPatch: Record<string, any> = normalizedBase?.tighten
      ?.constraintsPatch
      ? { ...normalizedBase.tighten.constraintsPatch }
      : {};

    for (const sensor of relevantSensors) {
      try {
        const t0 = Date.now();
        const rawDecision = await sensor.run(input);
        const elapsed = Date.now() - t0;
        const decision = normalizeSensorDecision(rawDecision);

        // Record into observation if present
        const obs = input.metadata?.observation as AxisObservation | undefined;
        if (obs) {
          recordSensor(
            obs,
            sensor.name,
            decision.allow,
            decision.riskScore,
            elapsed,
            decision.reasons,
            decision.allow ? undefined : (decision as any).code,
          );
        }

        // Hard block: any sensor can deny
        if (!decision.allow) {
          return {
            allow: false,
            riskScore: Math.min(100, riskScore + decision.riskScore),
            reasons: [...reasons, ...decision.reasons],
            tags,
          };
        }

        // Aggregate risk (cap at 100)
        riskScore = Math.min(100, riskScore + decision.riskScore);
        reasons.push(...decision.reasons);

        // Merge tags
        if (decision.tags) {
          Object.assign(tags, decision.tags);
        }

        // Tighten constraints (take most restrictive)
        if (decision.tighten?.expSecondsMax !== undefined) {
          expSecondsMax =
            expSecondsMax === undefined
              ? decision.tighten.expSecondsMax
              : Math.min(expSecondsMax, decision.tighten.expSecondsMax);
        }

        if (decision.tighten?.constraintsPatch) {
          constraintsPatch = {
            ...constraintsPatch,
            ...decision.tighten.constraintsPatch,
          };
        }
      } catch (error) {
        // Sensor failure = fail closed
        console.error(`[AXIS][SENSOR] ${sensor.name} failed:`, error);

        const obs = input.metadata?.observation as AxisObservation | undefined;
        if (obs) {
          recordSensor(obs, sensor.name, false, 100, 0, [
            `sensor_error:${sensor.name}`,
          ]);
        }

        return {
          allow: false,
          riskScore: 100,
          reasons: [`sensor_error:${sensor.name}`],
        };
      }
    }

    const tightenPatch =
      Object.keys(constraintsPatch).length > 0 ? constraintsPatch : undefined;

    return {
      allow: true,
      riskScore,
      reasons,
      tags,
      tighten:
        expSecondsMax !== undefined || tightenPatch
          ? {
              expSecondsMax,
              constraintsPatch: tightenPatch,
            }
          : undefined,
    };
  }
}
