import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
/**
 * CCE Client — Capsule-Carried Encryption Client Module
 *
 * Client-side operations for the CCE protocol:
 * 1. Request challenge from TickAuth
 * 2. Sign challenge (presence proof)
 * 3. Receive capsule
 * 4. Encrypt payload to AXIS (hybrid: AES-GCM + AXIS public key)
 * 5. Sign request envelope
 * 6. Send to AXIS
 * 7. Verify AXIS response signature
 * 8. Decrypt response
 */
import { sha256 } from "@noble/hashes/sha2.js";

// ============================================================================
// CCE Protocol Constants (mirrored from server)
// ============================================================================

export const CCE_PROTOCOL_VERSION = "cce-v1" as const;
export const CCE_NONCE_BYTES = 32;

// ============================================================================
// Types
// ============================================================================

export interface CceSignature {
  alg: "EdDSA" | "ES256";
  kid: string;
  value: string;
}

export interface CceCapsuleClaims {
  capsule_id: string;
  ver: typeof CCE_PROTOCOL_VERSION;
  sub: string;
  kid: string;
  intent: string;
  aud: string;
  tps_from: number;
  tps_to: number;
  capsule_nonce: string;
  challenge_id: string;
  proof_hash?: string;
  policy_hash?: string;
  iat: number;
  exp: number;
  mode: "SINGLE_USE" | "SESSION";
  scope?: string[];
  constraints?: Record<string, unknown>;
  issuer_sig: CceSignature;
}

export interface CceEncryptedKey {
  alg: "X25519" | "RSA-OAEP-256";
  axis_kid: string;
  ciphertext: string;
  ephemeral_pk?: string;
}

export interface CceEncryptedPayload {
  alg: "AES-256-GCM";
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface CceRequestEnvelope {
  ver: typeof CCE_PROTOCOL_VERSION;
  request_id: string;
  correlation_id: string;
  client_kid: string;
  capsule: CceCapsuleClaims;
  encrypted_key: CceEncryptedKey;
  encrypted_payload: CceEncryptedPayload;
  request_nonce: string;
  client_sig: CceSignature;
  content_type: string;
  algorithms: {
    kem: "X25519" | "RSA-OAEP-256";
    enc: "AES-256-GCM";
    kdf: "HKDF-SHA256";
    sig: "EdDSA" | "ES256";
  };
}

export interface CceResponseEnvelope {
  ver: typeof CCE_PROTOCOL_VERSION;
  response_id: string;
  request_id: string;
  correlation_id: string;
  capsule_id: string;
  encrypted_key: CceEncryptedKey;
  encrypted_payload: CceEncryptedPayload;
  response_nonce: string;
  axis_sig: CceSignature;
  witness_ref?: string;
  algorithms: {
    kem: "X25519" | "RSA-OAEP-256";
    enc: "AES-256-GCM";
    kdf: "HKDF-SHA256";
    sig: "EdDSA" | "ES256";
  };
  status: string;
}

// ============================================================================
// Client-side Crypto Interfaces (pluggable)
// ============================================================================

/**
 * Client signer — signs the request envelope.
 */
export interface CceClientSigner {
  readonly kid: string;
  readonly alg: "EdDSA" | "ES256";
  sign(message: Uint8Array): Promise<string>; // Returns hex signature
}

/**
 * AES key encryptor — wraps AES key with AXIS public key.
 */
export interface CceKeyEncryptor {
  wrapKeyForAxis(
    aesKey: Uint8Array,
    axisPublicKeyHex: string,
    axisKid: string,
  ): Promise<CceEncryptedKey>;
}

/**
 * AES key decryptor — unwraps AES key from response using client private key.
 */
export interface CceKeyDecryptor {
  unwrapKey(encryptedKey: CceEncryptedKey): Promise<Uint8Array>;
}

/**
 * AES-GCM provider for client-side encryption/decryption.
 */
export interface CceAesProvider {
  encrypt(
    key: Uint8Array,
    plaintext: Uint8Array,
    aad?: Uint8Array,
  ): Promise<{ iv: string; ciphertext: string; tag: string }>;

  decrypt(
    key: Uint8Array,
    iv: string,
    ciphertext: string,
    tag: string,
    aad?: Uint8Array,
  ): Promise<Uint8Array>;
}

/**
 * Signature verifier for AXIS response signatures.
 */
export interface CceAxisSignatureVerifier {
  verify(
    message: Uint8Array,
    signatureHex: string,
    publicKeyHex: string,
  ): Promise<boolean>;
}

// ============================================================================
// CCE Envelope Builder
// ============================================================================

export interface BuildCceRequestOptions {
  /** The capsule claims from TickAuth */
  capsule: CceCapsuleClaims;
  /** Plaintext payload to encrypt */
  payload: Uint8Array;
  /** Client signer */
  signer: CceClientSigner;
  /** Key encryptor for AXIS public key */
  keyEncryptor: CceKeyEncryptor;
  /** AES-GCM provider */
  aesProvider: CceAesProvider;
  /** AXIS public key (hex) */
  axisPublicKeyHex: string;
  /** AXIS key identifier */
  axisKid: string;
  /** Content type of the plaintext payload */
  contentType?: string;
  /** Optional correlation ID (auto-generated if not provided) */
  correlationId?: string;
}

/**
 * Build a CCE request envelope.
 *
 * Performs the client-side encryption flow:
 * 1. Generate ephemeral AES-256 key
 * 2. Encrypt payload with AES-GCM
 * 3. Encrypt AES key with AXIS public key
 * 4. Sign the envelope
 */
export async function buildCceRequest(
  options: BuildCceRequestOptions,
): Promise<CceRequestEnvelope> {
  const {
    capsule,
    payload,
    signer,
    keyEncryptor,
    aesProvider,
    axisPublicKeyHex,
    axisKid,
  } = options;

  // Generate request ID and nonce
  const requestId = generateRequestId();
  const correlationId = options.correlationId ?? generateCorrelationId();
  const requestNonce = generateNonce();

  // Build AAD (binds ciphertext to request context)
  const aad = buildRequestAad(
    CCE_PROTOCOL_VERSION,
    requestId,
    correlationId,
    signer.kid,
    capsule.capsule_id,
    capsule.intent,
    capsule.aud,
    requestNonce,
  );

  // Encrypt payload with ephemeral AES key
  // The AES provider handles key generation internally
  const aesKey = generateAesKey();
  const encrypted = await aesProvider.encrypt(aesKey, payload, aad);

  // Wrap AES key with AXIS public key
  const encryptedKey = await keyEncryptor.wrapKeyForAxis(
    aesKey,
    axisPublicKeyHex,
    axisKid,
  );

  // Clear the raw AES key
  aesKey.fill(0);

  const contentType = options.contentType ?? "application/json";

  const algorithms = {
    kem: encryptedKey.alg,
    enc: "AES-256-GCM" as const,
    kdf: "HKDF-SHA256" as const,
    sig: signer.alg,
  };

  // Build unsigned envelope
  const unsigned: Omit<CceRequestEnvelope, "client_sig"> = {
    ver: CCE_PROTOCOL_VERSION,
    request_id: requestId,
    correlation_id: correlationId,
    client_kid: signer.kid,
    capsule,
    encrypted_key: encryptedKey,
    encrypted_payload: {
      alg: "AES-256-GCM",
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      tag: encrypted.tag,
    },
    request_nonce: requestNonce,
    content_type: contentType,
    algorithms,
  };

  // Sign the canonical envelope
  const signPayload = new TextEncoder().encode(canonicalize(unsigned));
  const sigValue = await signer.sign(signPayload);

  return {
    ...unsigned,
    client_sig: {
      alg: signer.alg,
      kid: signer.kid,
      value: sigValue,
    },
  };
}

// ============================================================================
// CCE Response Decryptor
// ============================================================================

export interface DecryptCceResponseOptions {
  /** The encrypted response envelope */
  response: CceResponseEnvelope;
  /** The original request ID (for binding verification) */
  requestId: string;
  /** The original request capsule ID (for strict response binding) */
  requestCapsuleId?: string;
  /** Key decryptor for unwrapping the response AES key */
  keyDecryptor: CceKeyDecryptor;
  /** AES-GCM provider */
  aesProvider: CceAesProvider;
  /** AXIS signature verifier */
  axisVerifier: CceAxisSignatureVerifier;
  /** AXIS public key (hex) for signature verification */
  axisPublicKeyHex: string;
}

/**
 * Decrypt a CCE response envelope.
 *
 * Performs:
 * 1. Verify AXIS signature
 * 2. Verify response is bound to our request
 * 3. Decrypt response AES key
 * 4. Decrypt response payload
 */
export async function decryptCceResponse(
  options: DecryptCceResponseOptions,
): Promise<{ plaintext: Uint8Array; status: string; witnessRef?: string }> {
  const {
    response,
    requestId,
    requestCapsuleId,
    keyDecryptor,
    aesProvider,
    axisVerifier,
    axisPublicKeyHex,
  } = options;

  if (response.ver !== CCE_PROTOCOL_VERSION) {
    throw new Error(
      `CCE_RESPONSE_VERSION_UNSUPPORTED: expected ${CCE_PROTOCOL_VERSION}, got ${response.ver}`,
    );
  }

  // Step 1: Verify AXIS signature
  const { axis_sig, ...signable } = response;
  const signPayload = new TextEncoder().encode(canonicalize(signable));
  const sigValid = await axisVerifier.verify(
    signPayload,
    axis_sig.value,
    axisPublicKeyHex,
  );
  if (!sigValid) {
    throw new Error(
      "CCE_RESPONSE_SIG_INVALID: AXIS response signature verification failed",
    );
  }

  // Step 2: Verify request binding
  if (response.request_id !== requestId) {
    throw new Error(
      `CCE_RESPONSE_BINDING_MISMATCH: expected request_id=${requestId}, got ${response.request_id}`,
    );
  }
  if (requestCapsuleId && response.capsule_id !== requestCapsuleId) {
    throw new Error(
      `CCE_RESPONSE_CAPSULE_MISMATCH: expected capsule_id=${requestCapsuleId}, got ${response.capsule_id}`,
    );
  }

  // Step 3: Decrypt AES key
  const aesKey = await keyDecryptor.unwrapKey(response.encrypted_key);

  // Step 4: Decrypt response payload
  // Build response AAD
  const aad = buildResponseAad(
    response.request_id,
    response.response_id,
    response.correlation_id,
    response.capsule_id,
    response.response_nonce,
  );

  let plaintext: Uint8Array;
  try {
    plaintext = await aesProvider.decrypt(
      aesKey,
      response.encrypted_payload.iv,
      response.encrypted_payload.ciphertext,
      response.encrypted_payload.tag,
      aad,
    );
  } finally {
    // Clear AES key
    aesKey.fill(0);
  }

  return {
    plaintext,
    status: response.status,
    witnessRef: response.witness_ref,
  };
}

// ============================================================================
// Helpers
// ============================================================================

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

function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "req_" + bytesToHex(bytes).slice(0, 24);
}

function generateCorrelationId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "cor_" + bytesToHex(bytes).slice(0, 24);
}

function generateNonce(): string {
  const bytes = new Uint8Array(CCE_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function generateAesKey(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

function buildRequestAad(
  ver: string,
  requestId: string,
  correlationId: string,
  clientKid: string,
  capsuleId: string,
  intent: string,
  aud: string,
  requestNonce: string,
): Uint8Array {
  const parts = [
    ver,
    requestId,
    correlationId,
    clientKid,
    capsuleId,
    intent,
    aud,
    requestNonce,
  ];
  return new TextEncoder().encode(parts.join("|"));
}

function buildResponseAad(
  requestId: string,
  responseId: string,
  correlationId: string,
  capsuleId: string,
  responseNonce: string,
): Uint8Array {
  const parts = [requestId, responseId, correlationId, capsuleId, responseNonce];
  return new TextEncoder().encode(parts.join("|"));
}
