import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Access Profile Resolver AxisSensor
 *
 * This sensor determines whether an AXIS request should be handled under the
 * 'PUBLIC' or 'GUARDED' access profile. It does this by checking for the presence
 * of authentication proofs in the request metadata.
 *
 * **Execution Order:** 50 (runs very early)
 *
 * **Core Concept:**
 * - If any structural proof is present (Capsule, Passport, or mTLS certificate),
 *   the request is flagged as `GUARDED`.
 * - Otherwise, it is treated as `PUBLIC`.
 *
 * **Impact:**
 * This determination is stored in `input.metadata.profile` and is used by
 * downstream sensors like `CapabilityEnforcementSensor` to decide whether
 * to enforce strict authorization checks.
 *
 * @class AccessProfileResolverSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 */
@Sensor()
export class AccessProfileResolverSensor implements AxisSensor {
  /** AxisSensor identifier */
  readonly name = "AccessProfileResolverSensor";

  /**
   * Execution order - runs early to establish the access profile
   * for downstream sensors.
   */
  readonly order = BAND.IDENTITY + 10;

  async supports(input: SensorInput): Promise<SensorDecision> {
    void input;
    return { action: "ALLOW" };
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    // Resolve profile: presence of proof => GUARDED, else PUBLIC
    const hasCapsule = !!input.metadata?.capsuleId;
    const hasPassport = !!input.metadata?.passportSig;
    const hasMTLS = !!input.metadata?.mtlsId;

    const profile = hasCapsule || hasPassport || hasMTLS ? "GUARDED" : "PUBLIC";

    // Store in metadata for downstream sensors
    if (!input.metadata) input.metadata = {};
    input.metadata.profile = profile;

    return { action: "ALLOW" };
  }
}
