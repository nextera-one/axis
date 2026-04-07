/**
 * CCE Client Signature Verification Sensor
 *
 * Band: IDENTITY (order: 45)
 * Phase: POST_DECODE
 *
 * Steps 4-5 from CCE verification order:
 * 4. Resolve client public key
 * 5. Verify client signature over canonical envelope
 */
import type { AxisSensor, SensorDecision, SensorInput } from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import { CCE_ERROR, type CceRequestEnvelope } from "../cce.types";

/**
 * Key resolver interface — implementations can look up Redis, DB, or in-memory.
 */
export interface CceClientKeyResolver {
  resolve(kid: string): Promise<{ publicKeyHex: string; alg: string } | null>;
}

/**
 * Signature verifier interface — pluggable for Ed25519, ES256, etc.
 */
export interface CceSignatureVerifier {
  verify(
    message: Uint8Array,
    signatureHex: string,
    publicKeyHex: string,
    alg: string,
  ): Promise<boolean>;
}

export class CceClientSignatureSensor implements AxisSensor {
  readonly name = "cce.client.signature";
  readonly order = 45;
  readonly phase = "POST_DECODE" as const;

  constructor(
    private readonly keyResolver: CceClientKeyResolver,
    private readonly signatureVerifier: CceSignatureVerifier,
  ) {}

  supports(input: SensorInput): boolean {
    return input.metadata?.cceEnvelopeValid === true;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const envelope = input.metadata?.cceEnvelope as CceRequestEnvelope;
    if (!envelope) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.INVALID_ENVELOPE],
        code: CCE_ERROR.INVALID_ENVELOPE,
      };
    }

    // Step 4: Resolve client public key
    const keyRecord = await this.keyResolver.resolve(envelope.client_kid);
    if (!keyRecord) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.CLIENT_KEY_NOT_FOUND}: kid=${envelope.client_kid}`,
        ],
        code: CCE_ERROR.CLIENT_KEY_NOT_FOUND,
      };
    }

    // Step 5: Verify client signature
    // Canonical signing payload: everything except client_sig
    const { client_sig, ...signable } = envelope;
    const canonical = canonicalize(signable);
    const message = new TextEncoder().encode(canonical);

    const valid = await this.signatureVerifier.verify(
      message,
      client_sig.value,
      keyRecord.publicKeyHex,
      keyRecord.alg,
    );

    if (!valid) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.CLIENT_SIG_INVALID],
        code: CCE_ERROR.CLIENT_SIG_INVALID,
      };
    }

    // Store resolved key for downstream
    input.metadata = input.metadata ?? {};
    input.metadata.cceClientKey = keyRecord;
    input.metadata.cceClientSigVerified = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
      meta: { kid: envelope.client_kid },
    };
  }
}

// Canonical JSON for deterministic signature verification
function canonicalize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }
  if (obj !== null && typeof obj === "object") {
    const sorted = Object.keys(obj as object)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalize((obj as Record<string, unknown>)[k]),
      );
    return "{" + sorted.join(",") + "}";
  }
  return JSON.stringify(obj);
}
