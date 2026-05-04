import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import {
  AxisSensor,
  Capability,
  INTENT_REQUIREMENTS,
  PROOF_CAPABILITIES,
  SensorDecision,
  SensorInput,
} from "../index";

/**
 * Capability Enforcement AxisSensor - Authorization Based on Proof Type
 *
 * Maps authentication proof types to capabilities and enforces capability
 * requirements per intent. This implements role-based access control (RBAC)
 * at the intent level.
 *
 * **Execution Order:** 100 (after capsule/signature verification)
 *
 * **Core Concept:**
 * Different authentication methods grant different capabilities:
 * - Stronger auth = more capabilities
 * - Weaker auth = fewer capabilities
 *
 * Each intent has required capabilities. The request's proof type must
 * grant ALL required capabilities for the intent to proceed.
 *
 * **Capability Definitions:**
 * - `read` - Can read/query data
 * - `write` - Can create/update data
 * - `execute` - Can trigger actions/operations
 * - `admin` - Administrative operations
 * - `sign` - Can create digital signatures
 * - `witness` - Can act as independent witness
 *
 * **Proof Type Mappings:**
 * | Type | Name | Capabilities |
 * |------|------|--------------|
 * | 0 | NONE | (none) |
 * | 1 | CAPSULE | read, write, execute |
 * | 2 | JWT | read |
 * | 3 | MTLS | read, write, admin |
 * | 4 | DEVICE_SE | read, write, sign |
 * | 5 | WITNESS_SIG | read, write, execute, witness |
 *
 * @class CapabilityEnforcementSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * File upload (requires 'write'):
 * ```typescript
 * // Proof type: CAPSULE (grants: read, write, execute)
 * // Intent: 'file.upload' (requires: write)
 * // write ∈ [read, write, execute] ✓
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Admin operation (requires 'admin'):
 * ```typescript
 * // Proof type: CAPSULE (grants: read, write, execute)
 * // Intent: 'admin.users.delete' (requires: admin)
 * // admin ∉ [read, write, execute] ✗
 * {
 *   action: 'DENY',
 *   code: 'CAPABILITY_DENIED',
 *   reason: 'Missing capabilities: admin'
 * }
 * ```
 */

@Sensor()
export class CapabilityEnforcementSensor implements AxisSensor {
  private readonly logger = {
    warn: (msg: string) => console.warn(`[CapabilityEnforcementSensor] ${msg}`),
  };

  /** AxisSensor identifier for logging and registry */
  readonly name = "CapabilityEnforcementSensor";

  /**
   * Execution order - runs after authentication
   *
   * Order 100 ensures:
   * - Capsule is verified (CapsuleVerifySensor @ 80)
   * - Signature is verified (SigVerifySensor @ 90)
   * - We know the proof type for capability lookup
   */
  readonly order = BAND.POLICY + 10;

  /**
   * Determines if this sensor should process the given input.
   *
   * Only activates when an intent is present.
   *
   * @param {SensorInput} input - Incoming AXIS request
   * @returns {boolean} True if intent is present
   */
  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    void input;
    return true;
  }

  /**
   * Enforces capability requirements for the requested intent.
   *
   * **Processing Flow:**
   * 1. Extract proof type from packet (default: 0/NONE)
   * 2. Look up capabilities granted by this proof type
   * 3. Look up capabilities required by the intent
   * 4. If no requirements, ALLOW
   * 5. Check if all required capabilities are granted
   * 6. If missing capabilities, DENY with details
   * 7. Otherwise, ALLOW
   *
   * @param {SensorInput} input - Request with intent and packet
   * @returns {Promise<SensorDecision>} ALLOW or DENY based on capabilities
   */
  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const { intent, packet } = input;
    if (!intent) {
      return { action: "ALLOW" };
    }

    const proofType = packet?.proofType ?? 0;

    // === STEP 1: Get Granted Capabilities ===
    // Look up what this proof type allows
    const grantedCapabilities = PROOF_CAPABILITIES[proofType] || [];

    // === STEP 2: Get Required Capabilities ===
    // Look up what this intent requires
    const requiredCapabilities = this.getRequiredCapabilities(intent);

    // === STEP 3: Check Public Intents ===
    // No capabilities required = public access
    if (requiredCapabilities.length === 0) {
      return { action: "ALLOW" };
    }

    // === STEP 4: Check Capability Match ===
    // Find any required capabilities not granted
    const missingCapabilities = requiredCapabilities.filter(
      (cap) => !grantedCapabilities.includes(cap),
    );

    if (missingCapabilities.length > 0) {
      // Capability mismatch - deny with details
      this.logger.warn(
        `Capability denied for ${intent}: missing ${missingCapabilities.join(", ")} (has: ${grantedCapabilities.join(", ")})`,
      );
      return {
        action: "DENY",
        code: "CAPABILITY_DENIED",
        reason: `Missing capabilities: ${missingCapabilities.join(", ")}`,
      };
    }

    // All required capabilities present
    return { action: "ALLOW" };
  }

  /**
   * Gets required capabilities for an intent.
   *
   * **Lookup Strategy:**
   * 1. Check for exact intent match
   * 2. Check for prefix pattern match (*.suffix)
   * 3. Default to 'execute' for unknown intents
   *
   * @private
   * @param {string} intent - Intent name to look up
   * @returns {Capability[]} Array of required capabilities
   */
  private getRequiredCapabilities(intent: string): Capability[] {
    // Check exact match first
    if (INTENT_REQUIREMENTS[intent]) {
      return INTENT_REQUIREMENTS[intent];
    }

    // Check prefix patterns (e.g., 'admin.*' matches 'admin.users.delete')
    for (const [pattern, caps] of Object.entries(INTENT_REQUIREMENTS)) {
      if (pattern.endsWith(".*")) {
        const prefix = pattern.slice(0, -1); // Remove '*'
        if (intent.startsWith(prefix)) {
          return caps;
        }
      }
    }

    // Default: require execute for unknown intents (safe default)
    return ["execute"];
  }
}
