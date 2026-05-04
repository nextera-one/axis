import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { ProtocolStrictInputZ } from "../schemas/axis-schemas";
import { AxisSensor } from "../sensor/axis-sensor";
import {
  AXIS_MAGIC,
  AXIS_VERSION,
  AxisMediaTypes,
  FLAG_BODY_TLV,
  FLAG_CHAIN_REQ,
  FLAG_HAS_WITNESS,
} from "../core/constants";
import { decodeVarint } from "../core/varint";
import { SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Valid flag combinations for AXIS frames.
 *
 * Flags can be combined using bitwise OR:
 * - 0x00: No flags (basic request)
 * - FLAG_BODY_TLV: Body section contains TLV-encoded data
 * - FLAG_CHAIN_REQ: Request requires receipt chaining
 * - FLAG_HAS_WITNESS: Frame includes witness signatures
 *
 * Any other flag combination is considered invalid.
 */
const VALID_FLAGS = [
  0x00, // No flags
  FLAG_BODY_TLV, // Body contains TLVs
  FLAG_CHAIN_REQ, // Requires receipt chaining
  FLAG_HAS_WITNESS, // Has witness signatures
  FLAG_BODY_TLV | FLAG_CHAIN_REQ,
  FLAG_BODY_TLV | FLAG_HAS_WITNESS,
  FLAG_CHAIN_REQ | FLAG_HAS_WITNESS,
  FLAG_BODY_TLV | FLAG_CHAIN_REQ | FLAG_HAS_WITNESS,
];

/**
 * Protocol Strict Sensor - Binary Protocol Validation Gateway
 *
 * **CRITICAL SECURITY COMPONENT - FIRST LINE OF DEFENSE**
 *
 * This sensor validates the raw binary structure of incoming AXIS frames before
 * any further processing occurs. It acts as the protocol gatekeeper, ensuring
 * only well-formed, spec-compliant frames are processed by the system.
 *
 * **Execution Order:** 10 (FIRST sensor in the chain)
 *
 * **Core Concept:**
 * AXIS uses a custom binary wire format for efficiency and security. This sensor
 * validates the frame structure at the byte level, catching malformed packets
 * before they can exploit parsing vulnerabilities deeper in the stack.
 *
 * **Frame Structure Validated:**
 * ```
 * +-------+-------+-------+-------+-------+-------+-------+...
 * | MAGIC (5 bytes: "AXIS1") | VER | FLAGS | HDR_LEN (varint)
 * +-------+-------+-------+-------+-------+-------+-------+...
 * | BODY_LEN (varint) | SIG_LEN (varint) | HDR TLVs... |
 * +-------+-------+-------+-------+-------+-------+-------+...
 * | BODY... | SIGNATURE... |
 * +-------+-------+-------+-------+-------+-------+-------+...
 * ```
 *
 * **Validations Performed:**
 * 1. **Content-Type** - Must be `application/axis-bin` or similar
 * 2. **Magic Bytes** - Must be "AXIS1" (5 bytes)
 * 3. **Version** - Must match AXIS_VERSION constant
 * 4. **Flags** - Must be a valid combination
 * 5. **Varint Encoding** - Must be minimal (no unnecessary bytes)
 * 6. **TLV Ordering** - Must be canonical (sorted by type)
 * 7. **Client Version** - TLV 100 should be present
 *
 * **Security Model:**
 * - **Fail Closed:** Invalid magic/version = DENY
 * - **Flag for Minor Issues:** Non-critical violations decrease trust score
 * - **Defense in Depth:** First of multiple validation layers
 *
 * **Actions:**
 * - `ALLOW` - Frame is well-formed and spec-compliant
 * - `DENY` - Critical protocol violation (magic, version, frame too short)
 * - `FLAG` - Minor issues that decrease trust score
 *
 * **Performance:**
 * - Validates first 20 bytes of each frame
 * - No external dependencies (pure byte validation)
 * - Latency: <1ms for typical frames
 *
 * @class ProtocolStrictSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * Valid AXIS frame:
 * ```typescript
 * // Frame starts with: "AXIS1" + version(1) + flags(0x01) + lengths...
 * // Sensor returns: { action: 'ALLOW' }
 * ```
 *
 * @example
 * Invalid magic bytes:
 * ```typescript
 * // Frame starts with: "HTTP1" (wrong protocol)
 * // Sensor returns: {
 * //   action: 'DENY',
 * //   code: 'INVALID_MAGIC',
 * //   reason: 'Expected AXIS1 magic, got HTTP1'
 * // }
 * ```
 *
 * @see {@link https://axis-spec.example.com/wire-format AXIS Wire Format Spec}
 */
@Sensor({ phase: "PRE_DECODE" })
export class ProtocolStrictSensor implements AxisSensor {
  private readonly logger = {
    error: (msg: string, ...args: unknown[]) =>
      console.error(`[ProtocolStrictSensor] ${msg}`, ...args),
    debug: (msg: string) => void 0,
    warn: (msg: string) => console.warn(`[ProtocolStrictSensor] ${msg}`),
  };

  /** Sensor identifier for logging and registry */
  readonly name = "ProtocolStrictSensor";

  /**
   * Execution order - FIRST sensor in the chain
   *
   * Order 10 ensures:
   * - Runs before any other processing
   * - Invalid frames rejected immediately
   * - Protects all downstream sensors from malformed input
   */
  readonly order = BAND.WIRE + 10;

  private protocolMagic: Uint8Array = AXIS_MAGIC;
  private protocolVersion = AXIS_VERSION;

  /**
   * Static validation for streaming middleware (Fast Check)
   */
  public static validateMagic(
    chunk: Uint8Array,
    expected: Uint8Array,
  ): { valid: boolean; actual?: string } {
    if (chunk.length < expected.length) return { valid: true }; // Not enough data yet
    const actual = chunk.subarray(0, expected.length);
    const valid = Buffer.from(actual).equals(Buffer.from(expected));
    return {
      valid,
      actual: valid ? undefined : new TextDecoder().decode(actual),
    };
  }

  public static validateVersion(version: number, expected: number): boolean {
    return version === expected;
  }

  /**
   * Lifecycle hook: Load config overrides on module initialization.
   */
  onModuleInit() {
    const magicStr = process.env["AXIS_PROTOCOL_MAGIC"];
    this.protocolMagic = magicStr ? Buffer.from(magicStr, "ascii") : AXIS_MAGIC;
    const versionStr = process.env["AXIS_PROTOCOL_VERSION"];
    this.protocolVersion = versionStr ? Number(versionStr) : AXIS_VERSION;
  }

  /**
   * Evaluate protocol strictness
   */
  // This sensor does not define supports(), so it is applicable whenever registered.
  // run() returns the actual ALLOW/DENY/FLAG/THROTTLE decision.
  async run(input: SensorInput): Promise<SensorDecision> {
    const validatedInput = ProtocolStrictInputZ.safeParse(input);
    if (!validatedInput.success) {
      this.logger.error(
        `Invalid input: ${validatedInput.error.message}`,
        validatedInput.error.issues,
      );
      return {
        action: "DENY",
        code: "INVALID_INPUT",
        reason: "Protocol validation input failed",
      };
    }

    const { contentType, peek } = validatedInput.data;
    const issues: string[] = [];

    // Debug: Log first 10 bytes
    if (peek.length >= 8) {
      const hex = Buffer.from(peek.subarray(0, 10)).toString("hex");
      this.logger.debug(`Raw Frame Header (Hex): ${hex} (IP: ${input.ip})`);
    }

    // 1. Check Content-Type header (HTTP only)
    if (contentType !== undefined) {
      if (!this.isValidContentType(contentType)) {
        issues.push(`invalid_content_type:${contentType}`);
      }
    }

    // Need at least 9 bytes for basic frame header (Magic:5, Ver:1, Flags:1, HLen:1, BLen:1, SLen:1)
    if (peek.length < 9) {
      return {
        action: "DENY",
        code: "FRAME_TOO_SHORT",
        reason: "Frame too short for protocol header",
      };
    }

    // 2. Check magic bytes
    const magicCheck = ProtocolStrictSensor.validateMagic(
      peek,
      this.protocolMagic,
    );
    if (!magicCheck.valid) {
      return {
        action: "DENY",
        code: "INVALID_MAGIC",
        reason: `Expected ${new TextDecoder().decode(this.protocolMagic)} magic, got ${magicCheck.actual}`,
      };
    }

    // 3. Check version (Offset 5)
    const version = peek[5];
    if (!ProtocolStrictSensor.validateVersion(version, this.protocolVersion)) {
      issues.push(`unsupported_version:${version}`);
    }

    // 4. Check flags validity (Offset 6)
    const flags = peek[6];
    if (!this.isValidFlags(flags)) {
      issues.push(`invalid_flags:0x${flags.toString(16)}`);
    }

    // 5. Check length encoding (varints should be minimal) - Starts at Offset 7
    if (peek.length >= 10) {
      const lengthCheck = this.checkVarintEncoding(peek.subarray(7));
      if (!lengthCheck.valid) {
        issues.push(`non_minimal_varint:${lengthCheck.reason}`);
      }
    }

    // 6. Check TLV ordering if we have enough data
    if (peek.length >= 20) {
      const tlvCheck = this.checkTLVOrdering(peek);
      if (!tlvCheck.valid) {
        issues.push(`tlv_not_canonical:${tlvCheck.reason}`);
      }

      // 7. Check Client Version (TLV 100) presence
      const hasClientVersion = await this.checkForClientVersion(peek);
      if (!hasClientVersion) {
        // Warn for now (Phase 7 Soft Rollout)
        issues.push("missing_client_version");
      }
    }

    // Return FLAG for minor issues, DENY for critical
    if (issues.length > 0) {
      // Check for critical issues
      const critical = issues.some(
        (i) =>
          i.startsWith("invalid_magic") || i.startsWith("unsupported_version"),
      );

      if (critical) {
        return {
          action: "DENY",
          code: "PROTOCOL_VIOLATION",
          reason: issues.join(", "),
        };
      }

      this.logger.warn(
        `Protocol issues from ${input.ip}: ${issues.join(", ")}`,
      );
      return {
        action: "FLAG",
        scoreDelta: -issues.length * 2,
        reasons: issues,
      };
    }

    return { action: "ALLOW" };
  }

  /**
   * Compare two buffers for equality
   */
  private buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Check if Content-Type is valid for AXIS
   */
  private isValidContentType(contentType: string): boolean {
    return AxisMediaTypes.isAxisContentType(contentType);
  }

  /**
   * Check if flags are a valid combination
   */
  private isValidFlags(flags: number): boolean {
    return VALID_FLAGS.includes(flags);
  }

  /**
   * Check varint encoding is minimal (no leading zeros)
   */
  private checkVarintEncoding(data: Uint8Array): {
    valid: boolean;
    reason?: string;
  } {
    try {
      const { value, length: bytesRead } = decodeVarint(data, 0);

      // Check for non-minimal encoding
      // A varint should use the minimum number of bytes
      if (value < 128 && bytesRead > 1) {
        return { valid: false, reason: "non-minimal-small-value" };
      }
      if (value < 16384 && bytesRead > 2) {
        return { valid: false, reason: "non-minimal-medium-value" };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: "varint-decode-error" };
    }
  }

  /**
   * Check TLV ordering is canonical (sorted by type, no duplicates)
   */
  private checkTLVOrdering(data: Uint8Array): {
    valid: boolean;
    reason?: string;
  } {
    // This is a simplified check - full check would require decoding the frame
    // For now, we do a heuristic check on the first few TLVs

    try {
      // Skip to length section (after magic, version, flags)
      let offset = 7;

      // Decode header length
      const { value: hdrLen, length: hdrBytes } = decodeVarint(data, offset);
      offset += hdrBytes;

      // Decode body length
      const { length: bodyBytes } = decodeVarint(data, offset);
      offset += bodyBytes;

      // Decode sig length
      const { length: sigBytes } = decodeVarint(data, offset);
      offset += sigBytes;

      // Now at HDR TLVs
      const hdrStart = offset;
      const hdrEnd = hdrStart + Number(hdrLen);

      if (hdrEnd > data.length) {
        return { valid: true }; // Not enough data to check
      }

      // Check TLV types are ascending
      let lastType = -1;
      let pos = hdrStart;

      while (pos < hdrEnd && pos < data.length - 2) {
        const { value: type, length: typeBytes } = decodeVarint(data, pos);
        pos += typeBytes;

        if (pos >= hdrEnd) break;

        const { value: len, length: lenBytes } = decodeVarint(data, pos);
        pos += lenBytes;

        // Check ordering
        if (Number(type) <= lastType) {
          return {
            valid: false,
            reason: `type-${type}-after-${lastType}`,
          };
        }

        lastType = Number(type);
        pos += Number(len);
      }

      return { valid: true };
    } catch {
      return { valid: true }; // On error, don't block
    }
  }

  /**
   * Check if TLV 100 (Client Version) exists in the headers
   */
  private async checkForClientVersion(data: Uint8Array): Promise<boolean> {
    try {
      let offset = 7;
      const { value: hdrLen, length: hdrBytes } = decodeVarint(data, offset);
      offset += hdrBytes;
      const { length: bodyBytes } = decodeVarint(data, offset);
      offset += bodyBytes;
      const { length: sigBytes } = decodeVarint(data, offset);
      offset += sigBytes;

      const hdrEnd = offset + Number(hdrLen);

      let pos = offset;
      while (pos < hdrEnd && pos < data.length) {
        const { value: type, length: typeBytes } = decodeVarint(data, pos);
        pos += typeBytes;
        const { length: lenBytes } = decodeVarint(data, pos); // value not needed
        pos += lenBytes;

        const { value: valLen, length: valLenBytes } = decodeVarint(
          data,
          pos - lenBytes,
        ); // reread legnth

        // Correct interaction: varint includes bytes read.
        // decodeVarint returns { value, length } -> length is how many bytes the varint took.
        // Wait, I need to read the length value to skip.

        // Re-do loop structure correctly:
        // 1. Read Type
        // 2. Read Length
        // 3. Skip Value
      }

      // Let's use a simpler heuristic scan for now as full parse is expensive here
      // and done elsewhere. But for correctness let's do it right.

      pos = offset;
      while (pos < hdrEnd && pos < data.length) {
        const t = decodeVarint(data, pos);
        pos += t.length;
        const l = decodeVarint(data, pos);
        pos += l.length;

        if (t.value === 100) return true;

        pos += Number(l.value);
      }

      return false;
    } catch {
      return false;
    }
  }
}
