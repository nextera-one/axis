import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Varint Hardening Sensor - Variable-Length Integer Overflow Protection
 *
 * Detects and blocks malicious varint values that could cause integer overflow
 * or excessive memory allocation. Varints in AXIS frames encode lengths and types.
 *
 * **Execution Order:** 40 (early, before length-based parsing)
 *
 * **Core Concept:**
 * AXIS uses variable-length integers (varints) to encode:
 * - Header length
 * - Body length
 * - Signature length
 * - TLV types and lengths
 *
 * Varints use a continuation bit (MSB) to indicate more bytes follow.
 * An attacker could send an extremely long varint (many continuation bytes)
 * to cause:
 * - Integer overflow
 * - Excessive parsing time
 * - Memory exhaustion
 *
 * **Varint Format:**
 * ```
 * Each byte: [1-bit continuation][7-bit data]
 *
 * Examples:
 * 127 = 0x7F (1 byte)
 * 128 = 0x80 0x01 (2 bytes)
 * 16384 = 0x80 0x80 0x01 (3 bytes)
 * ```
 *
 * **Limit:** Maximum 5 bytes per varint
 * - 5 bytes = 35 bits of data = max value ~34 billion
 * - Sufficient for any legitimate length in AXIS
 *
 * **How It Works:**
 * ```
 * 1. Skip to varint start (offset 7: after magic+version+flags)
 * 2. Count consecutive bytes with MSB set (continuation bit)
 * 3. If count > 5, reject frame
 * ```
 *
 * **Security Model:**
 * - **Fail Closed:** Overflow = DENY
 * - **Early Detection:** Before full parsing
 * - **Low Cost:** Simple bit check
 *
 * **Actions:**
 * - `ALLOW` - Varint within bounds
 * - `DENY` - Varint exceeds 5 bytes
 *
 * **Error Codes:**
 * - `VARINT_OVERFLOW` - Varint exceeds maximum length
 *
 * **Performance:**
 * - Bit masking: O(1) per byte
 * - Maximum 15 bytes checked
 * - Latency: <0.1ms
 *
 * @class VarintHardeningSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * Valid varint:
 * ```typescript
 * // Length 16384 encoded as 0x80 0x80 0x01 (3 bytes)
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Overflow attack:
 * ```typescript
 * // 6 bytes with continuation bits set
 * {
 *   action: 'DENY',
 *   code: 'VARINT_OVERFLOW',
 *   reason: 'Varint exceeds 5 bytes'
 * }
 * ```
 *
 * @see {@link BodyBudgetSensor} - Uses varints for length parsing
 */
@Sensor({ phase: "PRE_DECODE" })
export class VarintHardeningSensor implements AxisSensor {
  /** Sensor identifier */
  readonly name = "VarintHardeningSensor";

  /**
   * Execution order - early detection
   *
   * Order 40 ensures:
   * - After protocol magic check
   * - Before length-based parsing
   */
  readonly order = BAND.WIRE + 35;

  /** Maximum allowed bytes for a single varint */
  private readonly MAX_VARINT_BYTES = 5;

  /**
   * Determines if this sensor should process the given input.
   *
   * Requires at least 7 bytes of peeked data.
   *
   * @param {SensorInput} input - Incoming request
   * @returns {boolean} True if sufficient peek data
   */
  async supports(input: SensorInput): Promise<SensorDecision> {
    return !!input.peek && input.peek.length >= 7
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "Insufficient peek data for varint hardening",
        };
  }

  /**
   * Validates varint lengths in frame header.
   *
   * **Processing Flow:**
   * 1. Skip to varint section (offset 7)
   * 2. Scan for continuation bytes (MSB = 1)
   * 3. Count consecutive continuation bytes
   * 4. DENY if count exceeds MAX_VARINT_BYTES
   *
   * @param {SensorInput} input - Request with peek data
   * @returns {Promise<SensorDecision>} ALLOW or DENY based on varint length
   */
  async run(input: SensorInput): Promise<SensorDecision> {
    // After magic(5) + version(1) + flags(1), varints follow for hdrLen, bodyLen, sigLen
    const peek = input.peek!;
    const offset = 7;
    const maxOffset = Math.min(offset + 15, peek.length);

    // Count consecutive bytes with continuation bit set (MSB = 1)
    let continuationCount = 0;
    for (let i = offset; i < maxOffset; i++) {
      if ((peek[i] & 0x80) !== 0) {
        continuationCount++;
        if (continuationCount > this.MAX_VARINT_BYTES) {
          return {
            action: "DENY",
            code: "VARINT_OVERFLOW",
            reason: `Varint exceeds ${this.MAX_VARINT_BYTES} bytes`,
          };
        }
      } else {
        // End of current varint - reset for next
        continuationCount = 0;
      }
    }

    return { action: "ALLOW" };
  }
}
