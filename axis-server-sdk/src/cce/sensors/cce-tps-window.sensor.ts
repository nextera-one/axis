/**
 * CCE TPS Window Validation Sensor
 *
 * Band: POLICY (order: 92)
 * Phase: POST_DECODE
 *
 * Step 7 from CCE verification order:
 * 7. Verify TPS window is current (not expired, not future)
 */
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import { CCE_ERROR, type CceCapsuleClaims } from "../cce.types";

/** Maximum acceptable clock skew in milliseconds */
const DEFAULT_SKEW_MS = 5000;

export class CceTpsWindowSensor implements AxisSensor {
  readonly name = "cce.tps.window";
  readonly order = 92;
  readonly phase = "POST_DECODE" as const;

  constructor(private readonly skewMs: number = DEFAULT_SKEW_MS) {}

  async supports(input: SensorInput): Promise<SensorDecision> {
    return input.metadata?.cceCapsuleVerified === true
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "CCE capsule not verified",
        };
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const capsule = input.metadata?.cceCapsule as CceCapsuleClaims | undefined;
    if (!capsule) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.MISSING_CAPSULE],
        code: CCE_ERROR.MISSING_CAPSULE,
      };
    }

    const nowMs = Date.now();

    // Check if TPS window has expired (with skew tolerance)
    if (nowMs > capsule.tps_to + this.skewMs) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.TPS_WINDOW_EXPIRED}: window ended at ${capsule.tps_to}, now=${nowMs}`,
        ],
        code: CCE_ERROR.TPS_WINDOW_EXPIRED,
      };
    }

    // Check if TPS window is in the future (with skew tolerance)
    if (nowMs < capsule.tps_from - this.skewMs) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.TPS_WINDOW_FUTURE}: window starts at ${capsule.tps_from}, now=${nowMs}`,
        ],
        code: CCE_ERROR.TPS_WINDOW_FUTURE,
      };
    }

    input.metadata = input.metadata ?? {};
    input.metadata.cceTpsValid = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
    };
  }
}
