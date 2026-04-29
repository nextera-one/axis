import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";
import { decodeVarint } from "../core/varint";

/**
 * TLV Parse AxisSensor - Type-Length-Value Parsing Verification
 *
 * Verifies that TLV data in packets is properly formed and follows
 * canonical ordering rules. Ensures binary payload integrity before
 * field extraction.
 *
 * **Execution Order:** 160 (after policy checks, before schema validation)
 *
 * Validates:
 * - TLV types are ascending (canonical ordering)
 * - No duplicate TLV types
 * - Length values are accurate (no buffer overrun)
 * - Varint encoding is minimal (no padding bytes)
 * - Tag values are > 0
 *
 * @class TLVParseSensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 */
@Sensor()
export class TLVParseSensor implements AxisSensor {
  readonly name = "TLVParseSensor";
  readonly order = BAND.CONTENT + 20;

  async supports(input: SensorInput): Promise<SensorDecision> {
    return !!input.packet
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "Packet is not available",
        };
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const packet = input.packet;
    if (!packet) return { action: "ALLOW" };

    // Validate header TLVs if raw header bytes are available
    const hdrBytes: Uint8Array | Buffer | undefined =
      packet.hdrBytes ?? packet.headerBytes;
    if (hdrBytes && hdrBytes.length > 0) {
      const result = this.validateCanonicalTLV(hdrBytes, "header");
      if (result) return result;
    }

    // Validate body TLVs if body is flagged as TLV-encoded
    const bodyBytes: Uint8Array | Buffer | undefined =
      packet.bodyBytes ?? input.body;
    const bodyIsTlv =
      packet.flags !== undefined ? (packet.flags & 0x01) !== 0 : false;

    // @Intent({ bodyProfile: 'RAW' }) explicitly skips body TLV validation
    const bodyProfile = input.metadata?.schema?.bodyProfile;
    const skipBody = bodyProfile === "RAW";

    if (!skipBody && bodyIsTlv && bodyBytes && bodyBytes.length > 0) {
      const result = this.validateCanonicalTLV(bodyBytes, "body");
      if (result) return result;
    }

    return { action: "ALLOW" };
  }

  /**
   * Validates a TLV buffer for canonical ordering, no duplicates,
   * valid bounds, and minimal varint encoding.
   */
  private validateCanonicalTLV(
    buf: Uint8Array,
    section: string,
  ): SensorDecision | null {
    let offset = 0;
    let lastType = -1;
    let count = 0;
    const maxItems = 512;

    while (offset < buf.length) {
      if (count >= maxItems) {
        return {
          action: "DENY",
          code: "TLV_LIMIT",
          reason: `Too many TLVs in ${section}`,
        };
      }

      // Decode TYPE varint
      let type: number;
      let typeLen: number;
      try {
        const r = decodeVarint(buf, offset);
        type = r.value;
        typeLen = r.length;
      } catch {
        return {
          action: "DENY",
          code: "TLV_PARSE_ERROR",
          reason: `Malformed type varint in ${section} at offset ${offset}`,
        };
      }
      offset += typeLen;

      // Tag must be > 0
      if (type <= 0) {
        return {
          action: "DENY",
          code: "TLV_INVALID_TAG",
          reason: `Invalid tag ${type} in ${section}`,
        };
      }

      // Canonical order: strictly ascending
      if (type <= lastType) {
        return {
          action: "DENY",
          code: "TLV_NOT_CANONICAL",
          reason: `Non-canonical tag order in ${section}: ${type} after ${lastType}`,
        };
      }
      lastType = type;

      // Decode LEN varint
      let len: number;
      let lenLen: number;
      try {
        const r = decodeVarint(buf, offset);
        len = r.value;
        lenLen = r.length;
      } catch {
        return {
          action: "DENY",
          code: "TLV_PARSE_ERROR",
          reason: `Malformed length varint in ${section}`,
        };
      }
      offset += lenLen;

      // Bounds check
      if (offset + len > buf.length) {
        return {
          action: "DENY",
          code: "TLV_TRUNCATED",
          reason: `TLV value truncated in ${section}`,
        };
      }

      offset += len;
      count++;
    }

    return null; // Valid
  }
}
