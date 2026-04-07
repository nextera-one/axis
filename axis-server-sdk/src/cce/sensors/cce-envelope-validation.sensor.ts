/**
 * CCE Envelope Validation Sensor
 *
 * Band: WIRE (order: 5)
 * Phase: PRE_DECODE
 *
 * Step 1-2 from CCE verification order:
 * 1. Validate envelope schema
 * 2. Check protocol version
 *
 * Fast-fails malformed CCE requests before any crypto work.
 */
import type { AxisSensor, SensorDecision, SensorInput } from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import { CCE_ERROR, CCE_NONCE_BYTES, CCE_PROTOCOL_VERSION, type CceRequestEnvelope } from "../cce.types";

const REQUIRED_FIELDS: (keyof CceRequestEnvelope)[] = [
  "ver",
  "request_id",
  "correlation_id",
  "client_kid",
  "capsule",
  "encrypted_key",
  "encrypted_payload",
  "request_nonce",
  "client_sig",
  "algorithms",
];

export class CceEnvelopeValidationSensor implements AxisSensor {
  readonly name = "cce.envelope.validation";
  readonly order = 5;
  readonly phase = "PRE_DECODE" as const;

  supports(input: SensorInput): boolean {
    // Only process CCE envelopes (detected by metadata flag or content type)
    return (
      input.metadata?.cce === true ||
      input.metadata?.contentType === "application/axis-cce"
    );
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const envelope = input.metadata?.cceEnvelope as
      | CceRequestEnvelope
      | undefined;

    if (!envelope) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.INVALID_ENVELOPE],
        code: CCE_ERROR.INVALID_ENVELOPE,
      };
    }

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (envelope[field] === undefined || envelope[field] === null) {
        return {
          allow: false,
          riskScore: 100,
          reasons: [`${CCE_ERROR.INVALID_ENVELOPE}: missing ${field}`],
          code: CCE_ERROR.INVALID_ENVELOPE,
        };
      }
    }

    // Check protocol version
    if (envelope.ver !== CCE_PROTOCOL_VERSION) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.UNSUPPORTED_VERSION}: ${envelope.ver}`],
        code: CCE_ERROR.UNSUPPORTED_VERSION,
      };
    }

    // Validate request nonce format (must be hex, correct length)
    if (!/^[0-9a-f]+$/i.test(envelope.request_nonce)) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.INVALID_ENVELOPE}: invalid request_nonce format`,
        ],
        code: CCE_ERROR.INVALID_ENVELOPE,
      };
    }

    if (envelope.request_nonce.length !== CCE_NONCE_BYTES * 2) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.INVALID_ENVELOPE}: request_nonce wrong length`],
        code: CCE_ERROR.INVALID_ENVELOPE,
      };
    }

    // Validate capsule has required fields
    const capsule = envelope.capsule;
    if (
      !capsule.capsule_id ||
      !capsule.ver ||
      !capsule.sub ||
      !capsule.kid ||
      !capsule.intent ||
      !capsule.aud ||
      !capsule.issuer_sig
    ) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.MISSING_CAPSULE}: incomplete capsule claims`],
        code: CCE_ERROR.MISSING_CAPSULE,
      };
    }

    // Validate encrypted key structure
    if (!envelope.encrypted_key.ciphertext || !envelope.encrypted_key.alg) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.MISSING_ENCRYPTED_KEY}: incomplete encrypted_key`,
        ],
        code: CCE_ERROR.MISSING_ENCRYPTED_KEY,
      };
    }

    // Pass: store parsed envelope in metadata for downstream sensors
    input.metadata = input.metadata ?? {};
    input.metadata.cceEnvelopeValid = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
    };
  }
}
