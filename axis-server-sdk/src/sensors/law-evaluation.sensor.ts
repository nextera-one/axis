import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import type {
  AxisLawEvaluationContext,
  AxisLawEvaluationResult,
  LawEvaluationSensorOptions,
} from "../law";
import { buildAxisLawEvaluationContext } from "../law";
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../sensor/axis-sensor";
import { createAxisLogger } from "../utils/axis-logger";

@Sensor()
export class LawEvaluationSensor implements AxisSensor {
  private readonly logger = createAxisLogger(LawEvaluationSensor.name);

  readonly name = "LawEvaluationSensor";
  readonly order = BAND.POLICY + 5;

  constructor(private readonly options: LawEvaluationSensorOptions = {}) {}

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    return !!this.options.evaluator && !!input.intent;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const evaluator = this.options.evaluator;
    if (!evaluator) {
      return { action: "ALLOW" };
    }

    const context = buildAxisLawEvaluationContext(input);

    let result: AxisLawEvaluationResult;
    try {
      result = await evaluator(context);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown law evaluation error";
      this.logger.error(
        `Law evaluation failed for ${input.intent}: ${message}`,
      );
      input.metadata = {
        ...(input.metadata ?? {}),
        lawEvaluation: {
          decision: "deny",
          reason: "Law evaluation failed",
          explanation: message,
        },
      };
      return {
        action: "DENY",
        code: "LAW_EVALUATION_ERROR",
        reason: message,
        meta: { lawDecision: "deny" },
      };
    }

    input.metadata = {
      ...(input.metadata ?? {}),
      lawEvaluation: {
        ...result,
        context: sanitizeLawContext(context),
      },
    };

    if (result.decision === "allow") {
      return {
        allow: true,
        riskScore: 0,
        reasons: result.reason ? [result.reason] : [],
        tags: {
          lawDecision: "allow",
          ...(result.applicable
            ? { lawApplicableArticles: result.applicable.length }
            : {}),
        },
        meta: result,
      };
    }

    if (result.decision === "conditional") {
      const mode = this.options.conditionalDecision ?? "deny";
      const reasons = [result.reason, result.explanation].filter(
        Boolean,
      ) as string[];

      if (mode === "allow") {
        return {
          allow: true,
          riskScore: 0,
          reasons,
          tags: {
            lawDecision: "conditional",
          },
          meta: result,
        };
      }

      if (mode === "flag") {
        return {
          action: "FLAG",
          scoreDelta: 25,
          reasons:
            reasons.length > 0
              ? reasons
              : [
                  "Execution is conditionally permitted pending additional requirements",
                ],
          meta: result,
        };
      }

      return {
        action: "DENY",
        code: "LAW_CONDITIONAL",
        reason:
          reasons.join(" | ") ||
          "Execution is conditionally permitted pending additional requirements",
        meta: { lawDecision: "conditional", evaluation: result },
      };
    }

    return {
      action: "DENY",
      code: "LAW_DENIED",
      reason:
        [result.reason, result.explanation].filter(Boolean).join(" | ") ||
        "Execution denied by law evaluation",
      meta: { lawDecision: "deny", evaluation: result },
    };
  }
}

function sanitizeLawContext(
  context: AxisLawEvaluationContext,
): Record<string, unknown> {
  return {
    actorId: context.actorId,
    intent: context.intent,
    audience: context.audience,
    tps: context.tps,
    country: context.country,
    ip: context.ip,
    path: context.path,
    clientId: context.clientId,
    deviceId: context.deviceId,
    sessionId: context.sessionId,
    capsuleId: context.capsuleId,
  };
}
