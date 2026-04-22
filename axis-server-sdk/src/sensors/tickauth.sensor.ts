
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import type { AxisSensor, SensorDecision, SensorInput } from '../sensor/axis-sensor';

/**
 * A TickAuth capsule as provided by the transport layer
 * or extracted by an earlier sensor.
 */
export interface TickAuthCapsuleRef {
  capsule_id: string;
  capsule_type?: string;
  intent?: string;
  mode?: string;
  verification?: {
    status: 'approved' | 'denied' | 'expired' | 'replay_rejected' | 'consumed' | 'revoked';
    reason?: string;
  };
  scope?: string[];
  single_use?: boolean;
  tick_index?: number;
}

/**
 * Pluggable TickAuth verifier.
 * Returns `null` if verification succeeds, or an error string if it fails.
 */
export type TickAuthVerifier = (
  capsule: TickAuthCapsuleRef,
  input: SensorInput,
) => Promise<string | null> | (string | null);

/**
 * Configuration for the TickAuth Sensor.
 */
export interface TickAuthSensorOptions {
  /**
   * Optional external verifier that performs full TickAuth handshake
   * validation (signature, window, replay).
   * If not provided the sensor performs structural checks only.
   */
  verifier?: TickAuthVerifier;

  /**
   * Whether to require the capsule intent to match the AXIS intent.
   * Defaults to true.
   */
  matchIntent?: boolean;

  /**
   * Accept these capsule types. If empty, all types are accepted.
   */
  acceptTypes?: string[];
}

/**
 * TickAuth Sensor — Validates TickAuth capsule handshake.
 *
 * Goes beyond `ProofPresenceSensor` (which only checks capsule *presence*)
 * to verify the capsule's structural integrity:
 *
 *   1. Capsule exists and has a valid ID
 *   2. Capsule status is 'approved'
 *   3. Capsule type is in the accept list (if configured)
 *   4. Capsule intent matches the AXIS intent (if matchIntent)
 *   5. External verifier (signature + replay + window) passes
 *
 * Runs in the IDENTITY band after proof-presence.
 */
@Sensor()
export class TickAuthSensor implements AxisSensor {
  readonly name = 'TickAuthSensor';
  readonly order = BAND.IDENTITY + 40; // after ProofPresenceSensor (30)

  private readonly verifier?: TickAuthVerifier;
  private readonly matchIntent: boolean;
  private readonly acceptTypes: Set<string> | null;

  constructor(options: TickAuthSensorOptions = {}) {
    this.verifier = options.verifier;
    this.matchIntent = options.matchIntent ?? true;
    this.acceptTypes = options.acceptTypes?.length
      ? new Set(options.acceptTypes)
      : null;
  }

  supports(input: SensorInput): boolean {
    // Only engage when a capsule reference is present
    return !!(
      input.metadata?.capsule ||
      input.metadata?.tickauthCapsule ||
      input.metadata?.cceEnvelope?.capsule
    );
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const capsule: TickAuthCapsuleRef | undefined =
      input.metadata?.capsule ??
      input.metadata?.tickauthCapsule ??
      input.metadata?.cceEnvelope?.capsule;

    if (!capsule) {
      return {
        allow: false,
        riskScore: 90,
        reasons: ['TickAuth capsule not found'],
        code: 'TICKAUTH_MISSING',
      };
    }

    // 1. Structural: capsule_id must be present
    if (!capsule.capsule_id || typeof capsule.capsule_id !== 'string') {
      return {
        allow: false,
        riskScore: 100,
        reasons: ['TickAuth capsule has no valid capsule_id'],
        code: 'TICKAUTH_INVALID_ID',
      };
    }

    // 2. Status check
    const status = capsule.verification?.status;
    if (status && status !== 'approved') {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `TickAuth capsule status is '${status}'${capsule.verification?.reason ? `: ${capsule.verification.reason}` : ''}`,
        ],
        code: `TICKAUTH_STATUS_${status.toUpperCase()}`,
      };
    }

    // 3. Type filter
    if (this.acceptTypes && capsule.capsule_type) {
      if (!this.acceptTypes.has(capsule.capsule_type)) {
        return {
          allow: false,
          riskScore: 80,
          reasons: [
            `TickAuth capsule type '${capsule.capsule_type}' is not in accept list`,
          ],
          code: 'TICKAUTH_TYPE_REJECTED',
        };
      }
    }

    // 4. Intent match
    if (this.matchIntent && input.intent && capsule.intent) {
      if (capsule.intent !== input.intent) {
        return {
          allow: false,
          riskScore: 80,
          reasons: [
            `TickAuth capsule intent '${capsule.intent}' does not match AXIS intent '${input.intent}'`,
          ],
          code: 'TICKAUTH_INTENT_MISMATCH',
        };
      }
    }

    // 5. External verifier (full handshake: sig, window, replay)
    if (this.verifier) {
      const error = await this.verifier(capsule, input);
      if (error) {
        return {
          allow: false,
          riskScore: 90,
          reasons: [`TickAuth verification failed: ${error}`],
          code: 'TICKAUTH_VERIFY_FAILED',
        };
      }
    }

    return {
      allow: true,
      riskScore: 0,
      reasons: [],
      tags: {
        tickauthCapsuleId: capsule.capsule_id,
        tickauthMode: capsule.mode,
        tickauthSingleUse: capsule.single_use,
      },
    };
  }
}
