import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../sensor/axis-sensor";
import { normalizeSensorDecision } from "../sensor/axis-sensor";
import type { AxisObservation } from "../engine/axis-observation";
import { recordSensor } from "../engine/axis-observation";
import { SensorRegistry } from "../engine/registry/sensor.registry";

export type { SensorInput, SensorDecision };

/**
 * The consolidated result of a sensor chain evaluation.
 */
export interface ChainResult {
  allowed: boolean;
  scoreDelta: number;
  statusCode: number;
  body?: string | Buffer | Uint8Array;
  headers?: Map<number, Uint8Array>;
}

export class AxisSensorChainService {
  constructor(private readonly registry: SensorRegistry) {}

  async evaluate(
    input: SensorInput,
    phase: "PRE_DECODE" | "POST_DECODE" | "BOTH" = "POST_DECODE",
    baseDecision?: SensorDecision,
  ): Promise<SensorDecision> {
    if (phase === "PRE_DECODE") {
      return this.evaluateSensors(this.registry.getPreDecodeSensors(), input);
    }

    if (phase === "BOTH") {
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

    return this.evaluateSensors(
      this.registry.getPostDecodeSensors(),
      input,
      baseDecision,
    );
  }

  async evaluatePre(input: SensorInput): Promise<SensorDecision> {
    return this.evaluateSensors(this.registry.getPreDecodeSensors(), input);
  }

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
    const relevantSensors = sensors.filter(
      (s) => !s.supports || s.supports(input),
    );

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

        if (!decision.allow) {
          return {
            allow: false,
            riskScore: Math.min(100, riskScore + decision.riskScore),
            reasons: [...reasons, ...decision.reasons],
            tags,
          };
        }

        riskScore = Math.min(100, riskScore + decision.riskScore);
        reasons.push(...decision.reasons);

        if (decision.tags) {
          Object.assign(tags, decision.tags);
        }

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
