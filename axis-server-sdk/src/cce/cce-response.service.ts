import { bytesToHex } from "@noble/hashes/utils.js";
/**
 * CCE Response Encryption Service
 *
 * Encrypts AXIS response payloads back to the client.
 *
 * v1 model:
 * - Generate ephemeral AES-256 key
 * - Encrypt response body with AES-GCM
 * - Encrypt AES key with client public key
 * - Sign response envelope with AXIS private key
 */
import { randomBytes } from "crypto";

import { aesGcmEncrypt, base64UrlEncode, generateAesKey, hashPayload } from "./cce-crypto";
import { CCE_NONCE_BYTES, CCE_PROTOCOL_VERSION, type CceAlgorithmDescriptor, type CceCapsuleClaims, type CceEncryptedKey, type CceEncryptedPayload, type CceRequestEnvelope, type CceResponseEnvelope, type CceResponseStatus, type CceSignature } from "./cce.types";

/**
 * Client public key encryptor — wraps AES key with client's public key.
 */
export interface CceClientKeyEncryptor {
  wrapKey(
    aesKey: Uint8Array,
    clientKid: string,
    clientPublicKeyHex: string,
  ): Promise<CceEncryptedKey>;
}

/**
 * AXIS signing provider — signs response envelopes.
 */
export interface CceAxisSigner {
  sign(payload: Uint8Array): Promise<CceSignature>;
}

/**
 * Options for building a CCE response.
 */
export interface CceResponseOptions {
  /** Original request envelope */
  request: CceRequestEnvelope;
  /** Verified capsule claims */
  capsule: CceCapsuleClaims;
  /** Response status */
  status: CceResponseStatus;
  /** Response body (plaintext) */
  body: Uint8Array;
  /** Client public key (hex) for response encryption */
  clientPublicKeyHex: string;
  /** Witness reference */
  witnessRef?: string;
}

/**
 * Build and encrypt a CCE response envelope.
 */
export async function buildCceResponse(
  options: CceResponseOptions,
  clientKeyEncryptor: CceClientKeyEncryptor,
  axisSigner: CceAxisSigner,
): Promise<{ envelope: CceResponseEnvelope; responsePayloadHash: string }> {
  const { request, capsule, status, body, clientPublicKeyHex, witnessRef } =
    options;

  // Generate response nonce
  const responseNonce = bytesToHex(
    new Uint8Array(randomBytes(CCE_NONCE_BYTES)),
  );

  // Generate response ID
  const responseId = generateResponseId();

  // Generate ephemeral AES key for response
  const aesKey = generateAesKey();

  // Build AAD for response (binds ciphertext to response context)
  const aad = buildResponseAad(
    request.request_id,
    responseId,
    request.correlation_id,
    capsule.capsule_id,
    responseNonce,
  );

  // Encrypt response body
  const { iv, ciphertext, tag } = aesGcmEncrypt(aesKey, body, aad);

  // Wrap AES key with client public key
  const encryptedKey = await clientKeyEncryptor.wrapKey(
    aesKey,
    request.client_kid,
    clientPublicKeyHex,
  );

  // Clear the raw AES key
  aesKey.fill(0);

  const encryptedPayload: CceEncryptedPayload = {
    alg: "AES-256-GCM",
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(ciphertext),
    tag: base64UrlEncode(tag),
  };

  const algorithms: CceAlgorithmDescriptor = {
    kem: encryptedKey.alg,
    enc: "AES-256-GCM",
    kdf: "HKDF-SHA256",
    sig: "EdDSA",
  };

  // Build unsigned response
  const unsignedResponse: Omit<CceResponseEnvelope, "axis_sig"> = {
    ver: CCE_PROTOCOL_VERSION,
    response_id: responseId,
    request_id: request.request_id,
    correlation_id: request.correlation_id,
    encrypted_key: encryptedKey,
    encrypted_payload: encryptedPayload,
    response_nonce: responseNonce,
    algorithms,
    status,
    ...(witnessRef ? { witness_ref: witnessRef } : {}),
  };

  // Sign the response
  const signPayload = new TextEncoder().encode(canonicalize(unsignedResponse));
  const axisSig = await axisSigner.sign(signPayload);

  const envelope: CceResponseEnvelope = {
    ...unsignedResponse,
    axis_sig: axisSig,
  };

  return {
    envelope,
    responsePayloadHash: hashPayload(body),
  };
}

/**
 * Build a plaintext (unencrypted) error response for cases where
 * encryption is impossible (e.g., before capsule verification).
 */
export function buildCceErrorResponse(
  requestId: string,
  correlationId: string,
  status: CceResponseStatus,
  errorCode: string,
  message: string,
): {
  ver: string;
  request_id: string;
  correlation_id: string;
  status: CceResponseStatus;
  error: { code: string; message: string };
} {
  return {
    ver: CCE_PROTOCOL_VERSION,
    request_id: requestId,
    correlation_id: correlationId,
    status,
    error: { code: errorCode, message },
  };
}

// ============================================================================
// Helpers
// ============================================================================

function generateResponseId(): string {
  const bytes = randomBytes(16);
  return "resp_" + bytesToHex(new Uint8Array(bytes)).slice(0, 24);
}

function buildResponseAad(
  requestId: string,
  responseId: string,
  correlationId: string,
  capsuleId: string,
  responseNonce: string,
): Uint8Array {
  const parts = [
    requestId,
    responseId,
    correlationId,
    capsuleId,
    responseNonce,
  ];
  return new TextEncoder().encode(parts.join("|"));
}

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
