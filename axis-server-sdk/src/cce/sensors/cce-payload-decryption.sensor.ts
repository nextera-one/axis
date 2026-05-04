/**
 * CCE Payload Decryption Sensor
 *
 * Band: CONTENT (order: 145)
 * Phase: POST_DECODE
 *
 * Steps 12-13 from CCE verification order:
 * 12. Decrypt transport key → decrypt payload
 * 13. Validate plaintext payload schema
 *
 * This sensor performs the actual cryptographic decryption of the request payload.
 * It unwraps the AES transport key using the AXIS private key, then decrypts
 * the payload with AES-256-GCM.
 */
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import { CCE_ERROR, type CceRequestEnvelope } from "../cce.types";

/**
 * AXIS private key provider for decrypting the transport key.
 */
export interface CceAxisKeyProvider {
  /**
   * Decrypt a transport key using AXIS private key.
   * Supports X25519 (ECDH) and RSA-OAEP key unwrapping.
   */
  unwrapKey(
    encryptedKeyB64: string,
    algorithm: string,
    axisKid: string,
    ephemeralPkB64?: string,
  ): Promise<Uint8Array | null>;
}

/**
 * AES-GCM decryption provider.
 */
export interface CceAesGcmProvider {
  /**
   * Decrypt ciphertext with AES-256-GCM.
   * @returns plaintext bytes, or null if AEAD tag verification failed
   */
  decrypt(
    key: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array,
    tag: Uint8Array,
    aad?: Uint8Array,
  ): Promise<Uint8Array | null>;
}

export interface CcePayloadValidatorResult {
  ok: boolean;
  intent?: string;
  code?: string;
  reason?: string;
}

/**
 * Optional decrypted payload validator.
 * Use this hook to enforce intent-specific schema checks before handler execution.
 */
export interface CcePayloadValidator {
  validate(
    plaintext: Uint8Array,
    envelope: CceRequestEnvelope,
  ): Promise<CcePayloadValidatorResult>;
}

export class CcePayloadDecryptionSensor implements AxisSensor {
  readonly name = "cce.payload.decryption";
  readonly order = 145;
  readonly phase = "POST_DECODE" as const;

  constructor(
    private readonly keyProvider: CceAxisKeyProvider,
    private readonly aesProvider: CceAesGcmProvider,
    private readonly maxPayloadBytes: number = 64 * 1024,
    private readonly payloadValidator?: CcePayloadValidator,
  ) {}

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    return input.metadata?.cceEnvelopeValid === true &&
      input.metadata?.cceClientSigVerified === true &&
      input.metadata?.cceCapsuleVerified === true &&
      input.metadata?.cceReplayClean === true;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
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

    // Step 11 (from spec): Decrypt transport key
    let aesKey: Uint8Array | null;
    try {
      aesKey = await this.keyProvider.unwrapKey(
        envelope.encrypted_key.ciphertext,
        envelope.encrypted_key.alg,
        envelope.encrypted_key.axis_kid,
        envelope.encrypted_key.ephemeral_pk,
      );
    } catch {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.KEY_UNWRAP_FAILED],
        code: CCE_ERROR.KEY_UNWRAP_FAILED,
      };
    }

    if (!aesKey) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.KEY_UNWRAP_FAILED],
        code: CCE_ERROR.KEY_UNWRAP_FAILED,
      };
    }

    // Step 12: Decrypt payload with AES-GCM
    let iv: Uint8Array;
    let ciphertext: Uint8Array;
    let tag: Uint8Array;

    try {
      iv = base64UrlDecode(envelope.encrypted_payload.iv);
      ciphertext = base64UrlDecode(envelope.encrypted_payload.ciphertext);
      tag = base64UrlDecode(envelope.encrypted_payload.tag);
    } catch {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.DECRYPTION_FAILED}: invalid base64url encoding`],
        code: CCE_ERROR.DECRYPTION_FAILED,
      };
    }

    // Check payload size before decryption
    if (ciphertext.length > this.maxPayloadBytes) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.PAYLOAD_TOO_LARGE}: ${ciphertext.length} > ${this.maxPayloadBytes}`,
        ],
        code: CCE_ERROR.PAYLOAD_TOO_LARGE,
      };
    }

    // Build AAD from envelope metadata (binds ciphertext to context)
    const aad = buildAad(envelope);

    let plaintext: Uint8Array | null;
    try {
      plaintext = await this.aesProvider.decrypt(
        aesKey,
        iv,
        ciphertext,
        tag,
        aad,
      );
    } catch {
      plaintext = null;
    } finally {
      // Clear AES key from memory (best effort)
      aesKey.fill(0);
    }

    if (!plaintext) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.AEAD_TAG_MISMATCH],
        code: CCE_ERROR.AEAD_TAG_MISMATCH,
      };
    }

    const capsule = input.metadata?.cceCapsule as
      | { intent: string }
      | undefined;

    // Built-in JSON intent binding check.
    if (capsule && isJsonContentType(envelope.content_type)) {
      const parsed = tryParseJsonObject(plaintext);
      if (parsed && typeof parsed.intent === "string") {
        if (parsed.intent !== capsule.intent) {
          return {
            allow: false,
            riskScore: 100,
            reasons: [
              `${CCE_ERROR.INTENT_SCHEMA_MISMATCH}: payload.intent=${parsed.intent}, capsule.intent=${capsule.intent}`,
            ],
            code: CCE_ERROR.INTENT_SCHEMA_MISMATCH,
          };
        }
        input.metadata = input.metadata ?? {};
        input.metadata.cceRequestIntent = parsed.intent;
      }
    }

    if (this.payloadValidator) {
      const verdict = await this.payloadValidator.validate(plaintext, envelope);
      if (!verdict.ok) {
        const code = verdict.code ?? CCE_ERROR.PAYLOAD_SCHEMA_INVALID;
        return {
          allow: false,
          riskScore: 100,
          reasons: [verdict.reason ?? code],
          code,
        };
      }

      if (verdict.intent) {
        input.metadata = input.metadata ?? {};
        input.metadata.cceRequestIntent = verdict.intent;
      }
    }

    // Store decrypted payload for handler
    input.metadata = input.metadata ?? {};
    input.metadata.cceDecryptedPayload = plaintext;
    input.metadata.cceDecryptionOk = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
    };
  }
}

/**
 * Build Additional Authenticated Data from envelope fields.
 * Binds the ciphertext to the request context and prevents
 * transplanting encrypted payloads between requests.
 */
function buildAad(envelope: CceRequestEnvelope): Uint8Array {
  const parts = [
    envelope.ver,
    envelope.request_id,
    envelope.correlation_id,
    envelope.client_kid,
    envelope.capsule.capsule_id,
    envelope.capsule.intent,
    envelope.capsule.aud,
    envelope.request_nonce,
  ];
  return new TextEncoder().encode(parts.join("|"));
}

function isJsonContentType(contentType: string | undefined): boolean {
  return (
    typeof contentType === "string" &&
    contentType.toLowerCase().includes("application/json")
  );
}

function tryParseJsonObject(
  payload: Uint8Array,
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Base64url decode */
function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return new Uint8Array(Buffer.from(base64 + padding, "base64"));
}
