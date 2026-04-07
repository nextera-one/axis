import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
/**
 * CCE Key Derivation Service
 *
 * Implements HKDF-based key derivation for the Capsule-Carried Encryption protocol.
 * Keys are never placed in capsules — they are derived from:
 * - AXIS local secret (IKM)
 * - Capsule claims (salt + info)
 * - Request/response nonce (direction binding)
 * - Protocol version (upgrade protection)
 *
 * Uses @noble/hashes HKDF (RFC 5869) with SHA-256.
 */
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { CCE_AES_KEY_BYTES, CCE_DERIVATION, CCE_NONCE_BYTES, type CceCapsuleClaims, type CceExecutionContext } from "./cce.types";

/**
 * Input parameters for key derivation.
 */
export interface CceDerivationInput {
  /** AXIS local secret (hex, must be kept private) */
  axisLocalSecret: string;
  /** Capsule claims from the request */
  capsule: CceCapsuleClaims;
  /** Request nonce (hex) */
  requestNonce: string;
  /** Response nonce (hex, only for response derivation) */
  responseNonce?: string;
}

/**
 * Build the salt for HKDF from capsule + nonce.
 *
 * salt = SHA-256(capsule_id || capsule_nonce || request_nonce)
 */
function buildSalt(
  capsuleId: string,
  capsuleNonce: string,
  requestNonce: string,
): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(
    capsuleId + "|" + capsuleNonce + "|" + requestNonce,
  );
  return sha256(data);
}

/**
 * Build the info string for HKDF.
 * Binds the derived key to all authority dimensions.
 *
 * info = context_prefix | sub | kid | intent | aud | tps_from | tps_to | policy_hash | ver
 */
function buildInfo(
  contextPrefix: string,
  capsule: CceCapsuleClaims,
  extraNonce?: string,
): Uint8Array {
  const encoder = new TextEncoder();
  const parts = [
    contextPrefix,
    capsule.sub,
    capsule.kid,
    capsule.intent,
    capsule.aud,
    String(capsule.tps_from),
    String(capsule.tps_to),
    capsule.policy_hash ?? "",
    capsule.ver,
  ];
  if (extraNonce) {
    parts.push(extraNonce);
  }
  return encoder.encode(parts.join("|"));
}

/**
 * Derive the request execution key.
 *
 * This key is used internally by AXIS to prove that:
 * 1. The request arrived with a valid capsule
 * 2. The capsule was bound to this specific intent/audience/subject
 * 3. AXIS possessed the local secret at derivation time
 *
 * The key itself is NEVER exposed — only its hash appears in witness records.
 */
export function deriveRequestExecutionKey(
  input: CceDerivationInput,
): Uint8Array {
  const ikm = hexToBytes(input.axisLocalSecret);
  const salt = buildSalt(
    input.capsule.capsule_id,
    input.capsule.capsule_nonce,
    input.requestNonce,
  );
  const info = buildInfo(CCE_DERIVATION.REQUEST, input.capsule);

  return hkdf(sha256, ikm, salt, info, CCE_AES_KEY_BYTES);
}

/**
 * Derive the response execution key.
 * Uses a different context prefix and includes the response nonce,
 * ensuring request and response keys are always distinct.
 */
export function deriveResponseExecutionKey(
  input: CceDerivationInput & { responseNonce: string },
): Uint8Array {
  const ikm = hexToBytes(input.axisLocalSecret);

  // Response salt uses a different construction
  const encoder = new TextEncoder();
  const saltData = encoder.encode(
    input.capsule.capsule_id +
      "|" +
      input.capsule.capsule_nonce +
      "|" +
      input.requestNonce +
      "|" +
      input.responseNonce,
  );
  const salt = sha256(saltData);

  const info = buildInfo(
    CCE_DERIVATION.RESPONSE,
    input.capsule,
    input.responseNonce,
  );

  return hkdf(sha256, ikm, salt, info, CCE_AES_KEY_BYTES);
}

/**
 * Derive the witness binding key.
 * Used to create tamper-evident witness records.
 */
export function deriveWitnessKey(input: CceDerivationInput): Uint8Array {
  const ikm = hexToBytes(input.axisLocalSecret);
  const salt = buildSalt(
    input.capsule.capsule_id,
    input.capsule.capsule_nonce,
    input.requestNonce,
  );
  const info = buildInfo(CCE_DERIVATION.WITNESS, input.capsule);

  return hkdf(sha256, ikm, salt, info, CCE_AES_KEY_BYTES);
}

/**
 * Build a complete execution context from capsule claims and derivation.
 * The execution key is derived but only its hash is stored.
 */
export function buildExecutionContext(
  input: CceDerivationInput,
  requestId: string,
): CceExecutionContext {
  const executionKey = deriveRequestExecutionKey(input);
  const keyHash = bytesToHex(sha256(executionKey));

  // Clear the raw key from memory (best effort)
  executionKey.fill(0);

  return {
    execution_key_hash: keyHash,
    request_id: requestId,
    capsule_id: input.capsule.capsule_id,
    sub: input.capsule.sub,
    kid: input.capsule.kid,
    intent: input.capsule.intent,
    aud: input.capsule.aud,
    tps_from: input.capsule.tps_from,
    tps_to: input.capsule.tps_to,
    policy_hash: input.capsule.policy_hash,
    derived_at: Math.floor(Date.now() / 1000),
    valid: true,
  };
}

/**
 * Generate a cryptographically secure nonce for CCE requests/responses.
 */
export function generateCceNonce(): string {
  const bytes = new Uint8Array(CCE_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
