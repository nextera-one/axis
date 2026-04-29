/**
 * Capsule-Carried Encryption (CCE) Types — v1
 *
 * Defines the core types for the CCE protocol where:
 * - TickAuth issues capsules (authority)
 * - AXIS verifies capsules, decrypts payloads, derives execution context
 * - Payload confidentiality uses hybrid encryption (AES-GCM + AXIS public key)
 */

// ============================================================================
// CCE Protocol Constants
// ============================================================================

export const CCE_PROTOCOL_VERSION = "cce-v1" as const;

/** Derivation context prefixes for HKDF */
export const CCE_DERIVATION = {
  /** Request execution context */
  REQUEST: "axis:cce:req:v1",
  /** Response execution context */
  RESPONSE: "axis:cce:resp:v1",
  /** Witness binding context */
  WITNESS: "axis:cce:witness:v1",
} as const;

/** Supported encryption algorithms */
export type CceAlgorithm = "AES-256-GCM";
/** Supported key encapsulation algorithms */
export type CceKemAlgorithm = "X25519" | "RSA-OAEP-256";
/** Supported KDF algorithms */
export type CceKdfAlgorithm = "HKDF-SHA256";

export const CCE_AES_KEY_BYTES = 32; // 256-bit AES key
export const CCE_IV_BYTES = 12; // 96-bit GCM nonce
export const CCE_TAG_BYTES = 16; // 128-bit GCM auth tag
export const CCE_NONCE_BYTES = 32; // 256-bit request/response nonce

// ============================================================================
// CCE Capsule Claims (extends TickAuth capsule for AXIS binding)
// ============================================================================

/**
 * CCE-specific claims that extend the TickAuth capsule.
 * These claims bind the capsule to a specific AXIS audience and intent.
 */
export interface CceCapsuleClaims {
  /** Capsule identifier (content-addressed) */
  capsule_id: string;
  /** Protocol version */
  ver: typeof CCE_PROTOCOL_VERSION;
  /** Subject / actor identity */
  sub: string;
  /** Client key identifier */
  kid: string;
  /** Bound intent */
  intent: string;
  /** AXIS audience (service identity) */
  aud: string;
  /** TPS window start (Unix ms or TPS index) */
  tps_from: number;
  /** TPS window end (Unix ms or TPS index) */
  tps_to: number;
  /** Capsule nonce (hex, from challenge) */
  capsule_nonce: string;
  /** Reference to originating challenge */
  challenge_id: string;
  /** Content hash of the validated proof used to issue this capsule */
  proof_hash?: string;
  /** Policy hash (hex) — Digital Fabric Law binding */
  policy_hash?: string;
  /** Issued-at timestamp (Unix seconds) */
  iat: number;
  /** Expires-at timestamp (Unix seconds) */
  exp: number;
  /** Capsule usage mode */
  mode: "SINGLE_USE" | "SESSION";
  /** Scope capabilities */
  scope?: string[];
  /** Constraints */
  constraints?: CceConstraints;
  /** TickAuth issuer signature over claims */
  issuer_sig: CceSignature;
}

export interface CceConstraints {
  max_payload_bytes?: number;
  ip_allow?: string[];
  device_allow?: string[];
  country_allow?: string[];
}

export interface CceSignature {
  alg: "EdDSA" | "ES256";
  kid: string;
  value: string; // base64url or hex
}

// ============================================================================
// CCE Request Envelope
// ============================================================================

/**
 * The encrypted request envelope sent from Client → AXIS.
 *
 * The client:
 * 1. Generates ephemeral AES-256 key
 * 2. Encrypts payload with AES-256-GCM
 * 3. Encrypts AES key with AXIS public key (X25519 or RSA-OAEP)
 * 4. Signs the envelope with client private key
 * 5. Attaches capsule
 */
export interface CceRequestEnvelope {
  /** Protocol version */
  ver: typeof CCE_PROTOCOL_VERSION;
  /** Unique request identifier */
  request_id: string;
  /** Correlation identifier (for request/response binding) */
  correlation_id: string;
  /** Client key identifier */
  client_kid: string;
  /** The capsule claims (signed by TickAuth) */
  capsule: CceCapsuleClaims;
  /** Encrypted transport key (AXIS public key encrypted) */
  encrypted_key: CceEncryptedKey;
  /** Encrypted payload */
  encrypted_payload: CceEncryptedPayload;
  /** Request nonce (hex, 32 bytes) */
  request_nonce: string;
  /** Client signature over canonical envelope */
  client_sig: CceSignature;
  /** Content type of the plaintext payload */
  content_type: string;
  /** Algorithm descriptors */
  algorithms: CceAlgorithmDescriptor;
  /** Additional authenticated data descriptor */
  aad_descriptor?: string;
}

/**
 * Encrypted symmetric key wrapped by AXIS public key.
 */
export interface CceEncryptedKey {
  /** Key encapsulation algorithm */
  alg: CceKemAlgorithm;
  /** AXIS key identifier used for encapsulation */
  axis_kid: string;
  /** Encrypted key bytes (base64url) */
  ciphertext: string;
  /** Ephemeral public key (for X25519 ECDH, base64url) */
  ephemeral_pk?: string;
}

/**
 * Encrypted payload with AEAD metadata.
 */
export interface CceEncryptedPayload {
  /** Encryption algorithm */
  alg: CceAlgorithm;
  /** Initialization vector / nonce (base64url, 12 bytes) */
  iv: string;
  /** Ciphertext (base64url) */
  ciphertext: string;
  /** Authentication tag (base64url, 16 bytes) */
  tag: string;
}

/**
 * Algorithm descriptor for the envelope.
 */
export interface CceAlgorithmDescriptor {
  /** Key encapsulation */
  kem: CceKemAlgorithm;
  /** Symmetric encryption */
  enc: CceAlgorithm;
  /** Key derivation (for execution context) */
  kdf: CceKdfAlgorithm;
  /** Signature algorithm */
  sig: "EdDSA" | "ES256";
}

// ============================================================================
// CCE Response Envelope
// ============================================================================

/**
 * The encrypted response envelope sent from AXIS → Client.
 */
export interface CceResponseEnvelope {
  /** Protocol version */
  ver: typeof CCE_PROTOCOL_VERSION;
  /** Response identifier */
  response_id: string;
  /** Request identifier (binding) */
  request_id: string;
  /** Correlation identifier */
  correlation_id: string;
  /** Capsule identifier of the originating request */
  capsule_id: string;
  /** Encrypted transport key (Client public key encrypted) */
  encrypted_key: CceEncryptedKey;
  /** Encrypted response payload */
  encrypted_payload: CceEncryptedPayload;
  /** Response nonce (hex, 32 bytes) */
  response_nonce: string;
  /** AXIS signature over canonical response */
  axis_sig: CceSignature;
  /** Witness reference */
  witness_ref?: string;
  /** Algorithm descriptors */
  algorithms: CceAlgorithmDescriptor;
  /** Response status (plaintext, allowed on error) */
  status: CceResponseStatus;
}

export type CceResponseStatus =
  | "SUCCESS"
  | "DENIED"
  | "PARTIAL"
  | "FAILED"
  | "ERROR";

// ============================================================================
// CCE Execution Context (derived inside AXIS)
// ============================================================================

/**
 * Execution context derived from capsule claims + AXIS local secret.
 * Proves that the request was not only decrypted but legally executable.
 */
export interface CceExecutionContext {
  /** Derived execution key (used for witness binding, never exposed) */
  execution_key_hash: string;
  /** Request identifier */
  request_id: string;
  /** Capsule identifier */
  capsule_id: string;
  /** Subject identity */
  sub: string;
  /** Client key identifier */
  kid: string;
  /** Intent */
  intent: string;
  /** Audience */
  aud: string;
  /** TPS window */
  tps_from: number;
  tps_to: number;
  /** Policy hash (if bound) */
  policy_hash?: string;
  /** Timestamp of context derivation */
  derived_at: number;
  /** Whether this context is valid */
  valid: boolean;
}

// ============================================================================
// CCE Witness Record
// ============================================================================

/**
 * Witness record for the CCE request/response lifecycle.
 */
export interface CceWitnessRecord {
  /** Witness identifier */
  witness_id: string;
  /** Request identifier */
  request_id: string;
  /** Capsule identifier */
  capsule_id: string;
  /** Subject identity */
  sub: string;
  /** Intent */
  intent: string;
  /** Audience */
  aud: string;
  /** TPS window */
  tps_from: number;
  tps_to: number;
  /** Timestamp */
  timestamp: number;

  /** Verification results */
  verification: {
    client_sig: boolean;
    capsule_sig: boolean;
    tps_valid: boolean;
    audience_match: boolean;
    intent_match: boolean;
    replay_clean: boolean;
    nonce_unique: boolean;
    decryption_ok: boolean;
  };

  /** Handler execution result */
  execution: {
    status: CceResponseStatus;
    handler_duration_ms: number;
    effect?: string;
  };

  /** Response encryption result */
  response_encrypted: boolean;

  /** Execution context hash (proves legal execution) */
  execution_context_hash: string;

  /** Payload hash (redacted, never raw content) */
  request_payload_hash?: string;
  response_payload_hash?: string;
}

// ============================================================================
// CCE Error Codes
// ============================================================================

export const CCE_ERROR = {
  // Envelope errors
  INVALID_ENVELOPE: "CCE_INVALID_ENVELOPE",
  UNSUPPORTED_VERSION: "CCE_UNSUPPORTED_VERSION",
  MISSING_CAPSULE: "CCE_MISSING_CAPSULE",
  MISSING_ENCRYPTED_KEY: "CCE_MISSING_ENCRYPTED_KEY",

  // Signature errors
  CLIENT_SIG_INVALID: "CCE_CLIENT_SIG_INVALID",
  CLIENT_KEY_NOT_FOUND: "CCE_CLIENT_KEY_NOT_FOUND",

  // Capsule errors
  CAPSULE_SIG_INVALID: "CCE_CAPSULE_SIG_INVALID",
  CAPSULE_EXPIRED: "CCE_CAPSULE_EXPIRED",
  CAPSULE_NOT_YET_VALID: "CCE_CAPSULE_NOT_YET_VALID",
  CAPSULE_REVOKED: "CCE_CAPSULE_REVOKED",
  CAPSULE_CONSUMED: "CCE_CAPSULE_CONSUMED",
  CAPSULE_NOT_VERIFIED: "CCE_CAPSULE_NOT_VERIFIED",
  // Binding errors
  AUDIENCE_MISMATCH: "CCE_AUDIENCE_MISMATCH",
  INTENT_MISMATCH: "CCE_INTENT_MISMATCH",
  TPS_WINDOW_EXPIRED: "CCE_TPS_WINDOW_EXPIRED",
  TPS_WINDOW_FUTURE: "CCE_TPS_WINDOW_FUTURE",

  // Replay / nonce errors
  REPLAY_DETECTED: "CCE_REPLAY_DETECTED",
  NONCE_REUSED: "CCE_NONCE_REUSED",

  // Decryption errors
  DECRYPTION_FAILED: "CCE_DECRYPTION_FAILED",
  KEY_UNWRAP_FAILED: "CCE_KEY_UNWRAP_FAILED",
  AEAD_TAG_MISMATCH: "CCE_AEAD_TAG_MISMATCH",
  PAYLOAD_TOO_LARGE: "CCE_PAYLOAD_TOO_LARGE",

  // Schema / validation errors
  PAYLOAD_SCHEMA_INVALID: "CCE_PAYLOAD_SCHEMA_INVALID",
  INTENT_SCHEMA_MISMATCH: "CCE_INTENT_SCHEMA_MISMATCH",

  // Policy errors
  POLICY_DENIED: "CCE_POLICY_DENIED",
  CONSTRAINT_VIOLATED: "CCE_CONSTRAINT_VIOLATED",

  // Handler errors
  HANDLER_NOT_FOUND: "CCE_HANDLER_NOT_FOUND",
  HANDLER_EXECUTION_FAILED: "CCE_HANDLER_EXECUTION_FAILED",
  HANDLER_TIMEOUT: "CCE_HANDLER_TIMEOUT",

  // Response errors
  RESPONSE_ENCRYPTION_FAILED: "CCE_RESPONSE_ENCRYPTION_FAILED",
} as const;

export type CceErrorCode = (typeof CCE_ERROR)[keyof typeof CCE_ERROR];

/**
 * Structured CCE error.
 */
export class CceError extends Error {
  constructor(
    public readonly code: CceErrorCode,
    message: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(`[${code}] ${message}`);
    this.name = "CceError";
  }

  /** Whether this error is safe to expose to the client */
  get clientSafe(): boolean {
    // Never expose internal decryption/handler details
    const internal: CceErrorCode[] = [
      CCE_ERROR.DECRYPTION_FAILED,
      CCE_ERROR.KEY_UNWRAP_FAILED,
      CCE_ERROR.AEAD_TAG_MISMATCH,
      CCE_ERROR.HANDLER_EXECUTION_FAILED,
      CCE_ERROR.RESPONSE_ENCRYPTION_FAILED,
    ];
    return !internal.includes(this.code);
  }

  /** Get client-safe representation */
  toClientError(): { code: CceErrorCode; message: string } {
    if (this.clientSafe) {
      return { code: this.code, message: this.message };
    }
    return {
      code: CCE_ERROR.DECRYPTION_FAILED,
      message: "Request processing failed",
    };
  }
}
