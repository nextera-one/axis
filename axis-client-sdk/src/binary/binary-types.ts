/**
 * Binary type definitions for AXIS protocol
 * Shared between client and server
 *
 * IMPORTANT: Tag values MUST match axis-server-sdk/src/core/constants.ts
 */

/**
 * TLV Type codes for frame headers
 * Aligned with server-sdk constants
 */
export enum TLVType {
  // Required headers
  PID = 1, // Packet ID (16 bytes, UUIDv7)
  TS = 2, // Timestamp (8 bytes, u64)
  INTENT = 3, // Intent name (UTF-8 string)
  ACTOR_ID = 4, // Actor/Citizen ID (16 bytes)
  PROOF_TYPE = 5, // Proof type enum (1 byte)
  PROOF_REF = 6, // Proof reference (variable)
  NONCE = 7, // Anti-replay nonce (16-32 bytes)

  // Optional headers
  REALM = 8, // Realm routing hint / Audience binding
  NODE = 9, // Node routing hint
  TRACE_ID = 10, // Trace correlation ID
  KID = 11, // Key ID for key rotation support

  // Receipt section tags (aligned with server-sdk)
  RID = 15, // Receipt ID
  OK = 16, // OK flag
  EFFECT = 17, // Effect descriptor
  ERROR_CODE = 18, // Error code
  ERROR_MSG = 19, // Error message
  PREV_HASH = 20, // Previous receipt hash (for chaining)
  RECEIPT_HASH = 21, // Receipt hash

  // Node certificate tags
  NODE_KID = 30, // Node Key ID
  NODE_CERT_HASH = 34, // Node cert hash

  // Application extensions
  UPLOAD_ID = 70, // Upload session identifier
  INDEX = 71, // Chunk index
  OFFSET = 72, // Byte offset
  SHA256_CHUNK = 73, // SHA-256 hash of chunk
  CAPSULE = 90, // Capsule identifier

  // Loom runtime
  LOOM_PRESENCE_ID = 91, // Loom presence ID
  LOOM_WRIT = 92, // Loom writ
  LOOM_THREAD_HASH = 93, // Loom thread hash
}

/**
 * Proof type enumeration
 * Aligned with server-sdk ProofType enum
 */
export enum ProofType {
  NONE = 0, // No proof / unauthenticated
  CAPSULE = 1, // Capsule-based proof
  JWT = 2, // JWT token
  MTLS = 3, // mTLS certificate identity
  LOOM = 4, // Loom Presence + Writ proof
  WITNESS = 5, // Witness signature
}

/**
 * Frame flags (bitfield)
 */
export enum FrameFlags {
  BODY_IS_TLV = 1 << 0, // Body is TLV encoded (vs raw bytes)
  RECEIPT_CHAINING = 1 << 1, // Client requests receipt chaining
  WITNESS_INCLUDED = 1 << 2, // Witness signature present
  COMPRESSED = 1 << 3, // Body compressed (reserved v2)
}

/**
 * Receipt TLV types (for receipt encoding)
 * Aligned with server-sdk receipt tag constants (TLV_RID=15 .. TLV_RECEIPT_HASH=21)
 */
export enum ReceiptTLVType {
  RID = 15, // Receipt ID (same tag as TLVType.RID)
  OK = 16, // Success flag
  EFFECT = 17, // Effect descriptor
  ERROR_CODE = 18, // Error code
  ERROR_MSG = 19, // Error message
  PREV_HASH = 20, // Previous receipt hash
  RECEIPT_HASH = 21, // Receipt hash
}

/**
 * Standard AXIS error codes
 */
export enum ErrorCode {
  INVALID_PACKET = 'INVALID_PACKET',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  BAD_SIGNATURE = 'BAD_SIGNATURE',
  PROOF_REQUIRED = 'PROOF_REQUIRED',
  CAPSULE_DENIED = 'CAPSULE_DENIED',
  SCOPE_MISMATCH = 'SCOPE_MISMATCH',
  RATE_LIMITED = 'RATE_LIMITED',
  REPLAY_DETECTED = 'REPLAY_DETECTED',
  RISK_DENIED = 'RISK_DENIED',
  STEP_UP_REQUIRED = 'STEP_UP_REQUIRED',
  WITNESS_REQUIRED = 'WITNESS_REQUIRED',
  CONTRACT_VIOLATION = 'CONTRACT_VIOLATION',
  INTENT_NOT_FOUND = 'INTENT_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
}

/**
 * TLV structure
 */
export interface TLV {
  type: number;
  value: Uint8Array;
}

/**
 * Decoded frame structure
 */
export interface DecodedFrame {
  magic: string;
  version: number;
  flags: number;
  headers: Map<number, Uint8Array>;
  body: Uint8Array;
  sig: Uint8Array;
}
