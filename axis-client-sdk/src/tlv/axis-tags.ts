/**
 * AXIS Tag Registry
 * Aligned with axis-backend/src/core/constants.ts
 * Uses varint encoding for TLV (same as backend)
 */

/**
 * TLV Tags for Header Section (matching backend)
 */
export const AXIS_TAG = {
  // ---- Core Header Tags (1-14) ----
  PID: 1, // Packet ID (16 bytes, UUIDv7)
  TS: 2, // Timestamp (8 bytes, u64 BE)
  INTENT: 3, // Intent name (UTF-8 string)
  ACTOR_ID: 4, // Actor/Citizen ID (16 bytes)
  PROOF_TYPE: 5, // Proof type enum (1 byte)
  PROOF_REF: 6, // Capsule ID / Proof reference (variable)
  NONCE: 7, // Anti-replay nonce (16-32 bytes)
  AUD: 8, // Audience binding
  NODE: 9, // Node routing hint
  TRACE_ID: 10, // Trace correlation ID
  KID: 11, // Key ID for key rotation

  // ---- Receipt Tags (15-34) ----
  RID: 15, // Receipt ID
  OK: 16, // Success flag
  EFFECT: 17, // Effect description
  ERROR_CODE: 18, // Error code
  ERROR_MSG: 19, // Error message
  PREV_HASH: 20, // Previous receipt hash
  RECEIPT_HASH: 21, // Receipt hash
  NODE_KID: 30, // Node key ID
  NODE_CERT_HASH: 34, // Node certificate hash

  // ---- Body Tags (100+) ----
  BODY: 100, // Binary body
  JSON: 200, // JSON-encoded body

  // ---- REST Bridge Tags (1000+, extension) ----
  HTTP_METHOD: 1001,
  HTTP_PATH: 1002,
  HTTP_QUERY: 1003,
  HTTP_HOST: 1004,
  HTTP_SCHEME: 1005,
  HTTP_HEADER: 1006, // repeated "k=v"

  // ---- Sensors / Context (2000+, extension) ----
  TPS: 2001, // Temporal-Physical Signature
  TICKAUTH: 2002, // TickAuth duration (uint32 BE)
  DEVICE: 2003, // SoftID device URI
  RISK_SCORE: 2004, // Risk score (uint8)

  // ---- Proof Pack (3000+, extension for nested proofs) ----
  PROOF_PACK: 3000,
  SIGN_ALG: 3001, // "ed25519"
  PUBKEY: 3002,
  SIGNATURE: 3003,
} as const;

/** Type for AXIS tag values */
export type AxisTag = (typeof AXIS_TAG)[keyof typeof AXIS_TAG];

/**
 * Proof type values (matching backend PROOF_* constants)
 */
export const PROOF_TYPE = {
  NONE: 0,
  CAPSULE: 1,
  JWT: 2,
  MTLS: 3,
  LOOM: 4,
  WITNESS: 5,
} as const;

export type ProofTypeValue = (typeof PROOF_TYPE)[keyof typeof PROOF_TYPE];

/**
 * Frame flags (matching backend FLAG_* constants)
 */
export const FRAME_FLAG = {
  BODY_TLV: 0x01,
  CHAIN_REQ: 0x02,
  HAS_WITNESS: 0x04,
} as const;
