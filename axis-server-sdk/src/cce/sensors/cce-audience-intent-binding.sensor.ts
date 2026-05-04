/**
 * CCE Audience & Intent Binding Sensor
 *
 * Band: POLICY (order: 95)
 * Phase: POST_DECODE
 *
 * Steps 8-9 from CCE verification order:
 * 8. Verify audience matches this AXIS instance
 * 9. Verify intent matches the capsule-bound intent
 */
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import {
  CCE_ERROR,
  type CceCapsuleClaims,
  type CceRequestEnvelope,
} from "../cce.types";

export class CceAudienceIntentBindingSensor implements AxisSensor {
  readonly name = "cce.audience.intent.binding";
  readonly order = 95;
  readonly phase = "POST_DECODE" as const;

  constructor(
    /** This AXIS instance's audience identifier */
    private readonly axisAudience: string,
  ) {}

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    return input.metadata?.cceCapsuleVerified === true;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const capsule = input.metadata?.cceCapsule as CceCapsuleClaims | undefined;
    const envelope = input.metadata?.cceEnvelope as
      | CceRequestEnvelope
      | undefined;

    if (!capsule || !envelope) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.MISSING_CAPSULE],
        code: CCE_ERROR.MISSING_CAPSULE,
      };
    }

    // Step 8: Verify audience
    if (capsule.aud !== this.axisAudience) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.AUDIENCE_MISMATCH}: capsule.aud=${capsule.aud}, expected=${this.axisAudience}`,
        ],
        code: CCE_ERROR.AUDIENCE_MISMATCH,
      };
    }

    // Step 9: Verify intent
    // The intent in the envelope should match the capsule-bound intent
    const requestIntent = input.intent ?? input.metadata?.cceRequestIntent;
    if (requestIntent && capsule.intent !== requestIntent) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.INTENT_MISMATCH}: capsule.intent=${capsule.intent}, request=${requestIntent}`,
        ],
        code: CCE_ERROR.INTENT_MISMATCH,
      };
    }

    // Verify client_kid in envelope matches capsule kid
    if (envelope.client_kid !== capsule.kid) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.INTENT_MISMATCH}: envelope.kid=${envelope.client_kid}, capsule.kid=${capsule.kid}`,
        ],
        code: CCE_ERROR.INTENT_MISMATCH,
      };
    }

    input.metadata = input.metadata ?? {};
    input.metadata.cceBindingVerified = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
    };
  }
}
