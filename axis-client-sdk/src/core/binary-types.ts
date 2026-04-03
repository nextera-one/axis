/**
 * AXIS-BIN v1 Binary Type Definitions
 * Defines TLV types, proof types, and frame flags for binary protocol
 */

/**
 * Header TLV Types (canonical ordering)
 * Range: 1-99 reserved for headers
 */
export enum TLVType {
  // Required header fields
  PID = 1, // Packet ID
  TS = 2, // Timestamp
  INTENT = 3, // Intent string
  ACTOR_ID = 4, // Actor ID
  PROOF_TYPE = 5, // Proof type
  PROOF_REF = 6, // Proof reference
  NONCE = 7, // Nonce

  // Security & Identity (aligned with standard)
  KID = 30, // Node key id
  SIG_ALG = 31, // Signature algorithm
  CERT_HASH = 34, // SHA-256 of NodeCert
  NODE_ID = 35, // Human readable node

  // Witness signatures (moved to avoid conflict)
  WITNESS_SIG_1 = 40,
  WITNESS_SIG_2 = 41,
  WITNESS_SIG_3 = 42,
  WITNESS_SIG_4 = 43,
  WITNESS_SIG_5 = 44,
}

/**
 * Body TLV Types (intent arguments)
 * Range: 100-999 reserved for body args
 */
export enum BodyTLVType {
  // Common arg types
  STRING = 100, // UTF-8 string
  U64 = 101, // Unsigned 64-bit integer
  I64 = 102, // Signed 64-bit integer
  BOOL = 103, // Boolean (1 byte: 0 or 1)
  BYTES = 104, // Raw bytes
  UUID = 105, // UUID (16 bytes)
  LIST = 106, // List (nested TLV sequence)
  MAP = 107, // Map (nested TLV sequence)
  FLOAT64 = 108, // IEEE 754 double
  TIMESTAMP = 109, // Timestamp (8 bytes bigint)
}

/**
 * Proof Types (how authority is proven)
 */
export enum ProofType {
  CAPSULE = 1, // Capsule capability token
  JWT = 2, // JSON Web Token
  MTLS_ID = 3, // mTLS identity
  DEVICE_SE = 4, // Device secure element (hardware)
  WITNESS_SIG = 5, // Witness signature
  PASSPORT = 6, // Protocol Passport
}

/**
 * Frame Flags (bitfield)
 */
export enum FrameFlags {
  BODY_IS_TLV = 1 << 0, // Body is TLV-encoded (vs raw bytes)
  RECEIPT_CHAINING = 1 << 1, // Receipt chaining requested
  WITNESS_INCLUDED = 1 << 2, // Witness signature included
  COMPRESSED = 1 << 3, // Body is compressed (future)
  BINARY_RESPONSE = 1 << 4, // Expect binary response
  // bits 5-7 reserved
}

/**
 * Receipt TLV Types
 * Range: 1-50 for receipt headers
 */
export enum ReceiptTLVType {
  RID = 15, // Receipt ID
  OK = 16, // Success flag (1 byte)
  EFFECT = 17, // Execution result
  ERROR_CODE = 18, // Machine-readable error
  ERROR_MESSAGE = 19, // Human-readable
  REQ_HASH = 21, // Hash of request
  RETRY_AFTER = 22, // Retry hints (ms)

  // Metadata (inherit from TLVType)
  KID = 30,
  CERT_HASH = 34,
  NODE_ID = 35,
}

/**
 * Standard Error Codes
 */
export const ErrorCodes = {
  INVALID_PACKET: 'INVALID_PACKET',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  BAD_SIGNATURE: 'BAD_SIGNATURE',
  REPLAY_DETECTED: 'REPLAY_DETECTED',
  TIMESTAMP_SKEW: 'TIMESTAMP_SKEW',
  PROOF_REQUIRED: 'PROOF_REQUIRED',
  CAPSULE_DENIED: 'CAPSULE_DENIED',
  SCOPE_MISMATCH: 'SCOPE_MISMATCH',
  RATE_LIMITED: 'RATE_LIMITED',
  RISK_DENIED: 'RISK_DENIED',
  WITNESS_REQUIRED: 'WITNESS_REQUIRED',
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
  INTENT_NOT_FOUND: 'INTENT_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * TLV Type Name Mapping (for debugging)
 */
export const TLVTypeNames: Record<number, string> = {
  [TLVType.PID]: 'pid',
  [TLVType.TS]: 'ts',
  [TLVType.INTENT]: 'intent',
  [TLVType.ACTOR_ID]: 'actorId',
  [TLVType.PROOF_TYPE]: 'proofType',
  [TLVType.PROOF_REF]: 'proofRef',
  [TLVType.NONCE]: 'nonce',
  [TLVType.KID]: 'kid',
  [TLVType.SIG_ALG]: 'sigAlg',
  [TLVType.CERT_HASH]: 'certHash',
  [TLVType.NODE_ID]: 'nodeId',
};

/**
 * Required Header TLV Types (must be present)
 */
export const REQUIRED_HEADER_TYPES = [
  TLVType.PID,
  TLVType.TS,
  TLVType.INTENT,
  TLVType.ACTOR_ID,
  TLVType.PROOF_TYPE,
  TLVType.PROOF_REF,
  TLVType.NONCE,
];
