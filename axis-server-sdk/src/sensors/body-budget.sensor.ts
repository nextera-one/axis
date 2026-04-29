import { MAX_BODY_LEN, MAX_HDR_LEN } from "../core/constants";
import { decodeVarint } from "../core/varint";
import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Body Budget AxisSensor - Section Size Limit Enforcement
 *
 * Validates that header and body sections of AXIS frames are within
 * configured size limits. This prevents memory exhaustion attacks and
 * ensures efficient processing.
 *
 * **Execution Order:** 150 (after auth, before schema validation)
 *
 * **Core Concept:**
 * AXIS frames have three main sections:
 * - Header (TLVs for routing, auth, etc.)
 * - Body (payload data)
 * - Signature
 *
 * Each section has a declared length in the frame header. This sensor
 * validates those lengths against configured maximums BEFORE reading
 * the full content.
 *
 * **Frame Format Reference:**
 * ```
 * Offset 0-4:  Magic (AXIS1)
 * Offset 5:    Version (0x01)
 * Offset 6:    Flags
 * Offset 7+:   HDR_LEN (varint)
 * Following:   BODY_LEN (varint)
 * Following:   SIG_LEN (varint)
 * Then:        HDR bytes, BODY bytes, SIG bytes
 * ```
 *
 * **Default Limits (from constants.ts):**
 * - MAX_HDR_LEN: 2048 bytes (2KB)
 * - MAX_BODY_LEN: 65536 bytes (64KB)
 *
 * **Security Model:**
 * - **Fail Open:** Parse errors allow (other sensors catch)
 * - **Early Rejection:** Rejects before reading large payloads
 * - **Defense in Depth:** Works with FrameBudgetSensor
 *
 * **Actions:**
 * - `ALLOW` - Sizes within limits
 * - `DENY` - Header or body exceeds maximum
 *
 * **Error Codes:**
 * - `HEADER_TOO_LARGE` - Header exceeds MAX_HDR_LEN
 * - `BODY_TOO_LARGE` - Body exceeds MAX_BODY_LEN
 *
 * **Performance:**
 * - Parses first ~20 bytes (varint lengths)
 * - O(1) comparison
 * - Latency: <0.5ms
 *
 * @class BodyBudgetSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * Within limits:
 * ```typescript
 * // HDR_LEN: 500 (< 2048), BODY_LEN: 10000 (< 65536)
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Body too large:
 * ```typescript
 * // BODY_LEN: 100000 (> 65536)
 * {
 *   action: 'DENY',
 *   code: 'BODY_TOO_LARGE',
 *   reason: 'Body size 100000 exceeds limit 65536'
 * }
 * ```
 *
 * @see {@link FrameBudgetSensor} - Content-Length based limiting
 * @see {@link MAX_BODY_LEN} - Configurable body limit
 */
@Sensor()
export class BodyBudgetSensor implements AxisSensor {
  /** AxisSensor identifier */
  readonly name = "BodyBudgetSensor";

  /**
   * Execution order - after authentication
   *
   * Order 150 ensures:
   * - Authentication complete
   * - Runs before full body read
   * - Before schema validation (170)
   */
  readonly order = BAND.CONTENT + 10;

  /**
   * Determines if this sensor should process the given input.
   *
   * Requires at least 8 bytes of peeked data to read headers.
   *
   * @param {SensorInput} input - Incoming request
   * @returns {boolean} True if sufficient peek data available
   */
  async supports(input: SensorInput): Promise<SensorDecision> {
    return !!input.peek && input.peek.length >= 8
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "Insufficient peek data to read headers",
        };
  }

  /**
   * Validates header and body lengths against configured limits.
   *
   * **Frame Parsing:**
   * - Skip magic (5 bytes)
   * - Skip version (1 byte)
   * - Skip flags (1 byte)
   * - Read HDR_LEN varint
   * - Read BODY_LEN varint
   * - Compare against MAX_HDR_LEN and MAX_BODY_LEN
   *
   * @param {SensorInput} input - Request with peek data
   * @returns {Promise<SensorDecision>} ALLOW or DENY based on size limits
   */
  async run(input: SensorInput): Promise<SensorDecision> {
    const { peek } = input;

    // Should be caught by ProtocolStrict, but defensive check
    if (!peek || peek.length < 8) {
      return { action: "ALLOW" };
    }

    try {
      // Frame structure:
      // 0-4: Magic (AXIS1)
      // 5: Version
      // 6: Flags
      // 7+: Varints for HDR_LEN, BODY_LEN, SIG_LEN

      let offset = 5; // After magic
      offset += 1; // Skip version
      offset += 1; // Skip flags

      // Now at offset 7: read HDR_LEN varint
      const { value: hdrLen, length: hdrBytes } = decodeVarint(peek, offset);
      offset += hdrBytes;

      // Read BODY_LEN varint
      const { value: bodyLen } = decodeVarint(peek, offset);

      // === Check Header Limit ===
      if (hdrLen > MAX_HDR_LEN) {
        return {
          action: "DENY",
          code: "HEADER_TOO_LARGE",
          reason: `Header size ${hdrLen} exceeds limit ${MAX_HDR_LEN}`,
        };
      }

      // === Check Body Limit ===
      if (bodyLen > MAX_BODY_LEN) {
        return {
          action: "DENY",
          code: "BODY_TOO_LARGE",
          reason: `Body size ${bodyLen} exceeds limit ${MAX_BODY_LEN}`,
        };
      }

      return { action: "ALLOW" };
    } catch (e) {
      // Parse errors are likely malformed frames
      // ProtocolStrict will handle them
      return { action: "ALLOW" };
    }
  }
}
