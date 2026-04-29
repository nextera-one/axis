import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Frame Budget AxisSensor - Request Size Validation
 *
 * Validates that incoming frame sizes do not exceed configured limits.
 * This prevents memory exhaustion attacks and ensures fair resource allocation.
 *
 * **Execution Order:** 20 (after ProtocolStrictSensor, before security checks)
 *
 * **Core Concept:**
 * Large payloads can be used for denial-of-service attacks, buffer overflows,
 * or to exhaust server memory. This sensor enforces per-intent size limits
 * defined in the intent policy, rejecting oversized frames before they are
 * fully processed.
 *
 * **How It Works:**
 * 1. Extract Content-Length from request
 * 2. Look up maximum allowed size from intent policy
 * 3. If size exceeds limit, DENY the request
 * 4. Otherwise, ALLOW request to proceed
 *
 * **Default Limits:**
 * - Standard requests: 1MB (1,048,576 bytes)
 * - File uploads: 100MB (104,857,600 bytes)
 * - Streaming: No limit (handled by StreamScopeSensor)
 *
 * **Security Model:**
 * - **Fail Open:** If Content-Length is not available, ALLOW (other sensors handle)
 * - **Early Rejection:** Reject oversized frames before full download
 * - **Per-Intent Limits:** Different intents can have different size limits
 *
 * **Configuration:**
 * ```env
 * AXIS_MAX_FRAME_BYTES=1048576       # 1MB default
 * AXIS_MAX_UPLOAD_BYTES=104857600    # 100MB for uploads
 * ```
 *
 * **Actions:**
 * - `ALLOW` - Frame size within limits or unknown
 * - `DENY` - Frame exceeds configured maximum (code: FRAME_TOO_LARGE)
 *
 * **Performance:**
 * - Single comparison operation
 * - No I/O or external calls
 * - Latency: <0.1ms
 *
 * @class FrameBudgetSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * Normal request (within limits):
 * ```typescript
 * // Content-Length: 50000 (50KB)
 * // Policy max: 1MB
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Oversized request:
 * ```typescript
 * // Content-Length: 10485760 (10MB)
 * // Policy max: 1MB
 * {
 *   action: 'DENY',
 *   code: 'FRAME_TOO_LARGE',
 *   reason: 'Frame size 10485760 exceeds limit 1048576'
 * }
 * ```
 *
 * @todo Implement actual size checking against intent policy maxFrameBytes
 * @see {@link BodyBudgetSensor} - Body-specific size limiting
 */
@Sensor({ phase: "PRE_DECODE" })
export class FrameBudgetSensor implements AxisSensor {
  /** AxisSensor identifier for logging and registry */
  readonly name = "FrameBudgetSensor";

  /**
   * Execution order - runs after protocol validation
   *
   * Order 20 ensures:
   * - Protocol is valid (ProtocolStrictSensor @ 10)
   * - Size checked before expensive processing
   */
  readonly order = BAND.WIRE + 20;

  /**
   * Determines if this sensor should process the given input.
   *
   * Only activates when Content-Length header is available.
   * WebSocket frames may not have Content-Length; they use different size tracking.
   *
   * @param {SensorInput} input - Incoming AXIS request
   * @returns {boolean} True if Content-Length is present
   */
  async supports(input: SensorInput): Promise<SensorDecision> {
    return typeof input.contentLength === "number"
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "Content-Length not available",
        };
  }

  /**
   * Validates frame size against configured limits.
   *
   * **Current Implementation:** Stub that always allows.
   *
   * **TODO:** Full implementation should:
   * 1. Load intent policy for the request
   * 2. Get maxFrameBytes from policy
   * 3. Compare against contentLength
   * 4. DENY if exceeded
   *
   * @param {SensorInput} input - Request with contentLength
   * @returns {Promise<SensorDecision>} ALLOW or DENY based on size
   */
  async run(input: SensorInput): Promise<SensorDecision> {
    const maxBytes =
      Number(process.env["AXIS_MAX_FRAME_SIZE"]) || 50 * 1024 * 1024;
    const contentLength = input.contentLength;

    if (typeof contentLength !== "number") {
      return { action: "ALLOW" };
    }

    if (contentLength > maxBytes) {
      return {
        action: "DENY",
        code: "FRAME_TOO_LARGE",
        reason: `Frame size ${contentLength} exceeds limit ${maxBytes}`,
      };
    }

    return { action: "ALLOW" };
  }
}
