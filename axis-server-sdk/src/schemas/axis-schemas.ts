import * as z from "zod";

import { AxisFrameZ } from "../core/axis-bin";

/**
 * AXIS Sensor Input/Output Validation Schemas
 *
 * Centralized Zod schemas for all sensor input validation.
 * Ensures type-safe, runtime-validated data across the entire sensor chain.
 *
 * Usage:
 *   const input = CountryBlockSensorInputZ.parse(data);
 *   const input = CountryBlockSensorInputZ.safeParse(data);
 */

// ============================================================================
// COMMON TYPES & UTILITIES
// ============================================================================

/**
 * Sensor decision outcomes (Zod version for schema composition)
 */
export const SensorDecisionZ = z.union([
  z.object({ action: z.literal("ALLOW"), meta: z.any().optional() }),
  z.object({
    action: z.literal("DENY"),
    code: z.string(),
    reason: z.string().optional(),
    meta: z.any().optional(),
  }),
]);

export const SensorDecisionWithMetadataZ = z.union([
  z.object({ action: z.literal("ALLOW"), meta: z.any().optional() }),
  z.object({
    action: z.literal("DENY"),
    code: z.string(),
    reason: z.string().optional(),
    retryAfterMs: z.number().int().positive().optional(),
    meta: z.any().optional(),
  }),
]);

// ============================================================================
// COUNTRY BLOCK SENSOR
// ============================================================================

export const CountryBlockSensorInputZ = z.object({
  ip: z.string().min(1),
  country: z.string().length(2).toUpperCase().optional(),
});
export type CountryBlockSensorInput = z.infer<typeof CountryBlockSensorInputZ>;

export const CountryBlockDecisionZ = SensorDecisionZ;
export type CountryBlockDecision = z.infer<typeof CountryBlockDecisionZ>;

// ============================================================================
// SCAN BURST SENSOR
// ============================================================================

export const ScanBurstSensorInputZ = z.object({
  ip: z.string().min(1),
  isFailure: z.boolean().optional(),
});
export type ScanBurstSensorInput = z.infer<typeof ScanBurstSensorInputZ>;

export const ScanBurstDecisionZ = SensorDecisionWithMetadataZ;
export type ScanBurstDecision = z.infer<typeof ScanBurstDecisionZ>;

// ============================================================================
// PROOF PRESENCE SENSOR
// ============================================================================

export const ProofKindZ = z.enum([
  "NONE",
  "ANONYMOUS",
  "PASSPORT",
  "CAPSULE",
  "JWT",
  "CONTRACT",
  "WITNESS",
  "MTLS",
  "DEVICE",
  "AUTHORIZED",
]);
export type ProofKind = z.infer<typeof ProofKindZ>;

export const AccessProfileZ = z.enum(["PUBLIC", "PARTNER", "INTERNAL", "NODE"]);
export type AccessProfile = z.infer<typeof AccessProfileZ>;

export const ProofPresenceInputZ = z.object({
  profile: AccessProfileZ,
  visibility: z.enum(["PUBLIC", "GUARDED"]),
  requiredProof: z.array(ProofKindZ).min(1),
  hasCapsule: z.boolean(),
  hasPassportSignature: z.boolean(),
  intent: z.string().min(1),
});
export type ProofPresenceInput = z.infer<typeof ProofPresenceInputZ>;

// ============================================================================
// INTENT POLICY SENSOR
// ============================================================================

export const SensitivityLevelZ = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type SensitivityLevel = z.infer<typeof SensitivityLevelZ>;

export const IntentPolicyZ = z.object({
  intent: z.string().min(1),
  sensitivity: SensitivityLevelZ,
  maxFrameBytes: z.number().int().positive(),
  maxHeaderBytes: z.number().int().positive(),
  maxBodyBytes: z.number().int().positive(),
  maxSigBytes: z.number().int().positive().optional(),
  rateLimitPerMinute: z.number().int().positive().optional(),
  rateLimitPerHour: z.number().int().positive().optional(),
  requiresSignature: z.boolean(),
  requiresCapsule: z.boolean(),
  timeoutMs: z.number().int().positive(),
});
export type IntentPolicy = z.infer<typeof IntentPolicyZ>;

export const IntentPolicySensorInputZ = z.object({
  frame: AxisFrameZ,
  intent: z.string().min(1),
  rawFrameSize: z.number().int().positive(),
});
export type IntentPolicySensorInput = z.infer<typeof IntentPolicySensorInputZ>;

export const IntentPolicyDecisionZ = z.union([
  z.object({
    action: z.literal("ALLOW"),
    policy: IntentPolicyZ,
  }),
  z.object({
    action: z.literal("DENY"),
    reason: z.string(),
  }),
]);
export type IntentPolicyDecision = z.infer<typeof IntentPolicyDecisionZ>;

// ============================================================================
// CAPSULE VERIFY SENSOR
// ============================================================================

export const CapsuleClaimsZ = z.object({
  capsuleId: z.string().min(8),
  allowIntents: z.array(z.string()).min(1),
  limits: z
    .object({
      maxBodyBytes: z.number().int().positive().optional(),
    })
    .optional(),
  scopes: z.record(z.string(), z.any()).optional(),
});
export type CapsuleClaims = z.infer<typeof CapsuleClaimsZ>;

export const CapsuleZ = z.object({
  id: z.string(),
  claims: CapsuleClaimsZ,
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  tier: z.enum(["FREE", "STANDARD", "PREMIUM"]),
});
export type Capsule = z.infer<typeof CapsuleZ>;

export const CapsuleValidationResultZ = z.object({
  valid: z.boolean(),
  capsule: CapsuleZ.optional(),
  reason: z.string().optional(),
  requiresStepUp: z.boolean().optional(),
});
export type CapsuleValidationResult = z.infer<typeof CapsuleValidationResultZ>;

export const CapsuleVerifySensorInputZ = z.object({
  headers: z.map(
    z.number(),
    z.custom<Uint8Array>((v) => v instanceof Uint8Array),
  ),
  intent: z.string().min(1),
  ctx: z.any(), // AxisContext - avoid circular dependency
});
export type CapsuleVerifySensorInput = z.infer<
  typeof CapsuleVerifySensorInputZ
>;

export const CapsuleVerifyResultZ = z.object({
  ok: z.literal(true),
  capsule: CapsuleZ,
});
export type CapsuleVerifyResult = z.infer<typeof CapsuleVerifyResultZ>;

// ============================================================================
// RATE LIMIT SENSOR
// ============================================================================

export const RateLimitProfileZ = z.enum([
  "PUBLIC",
  "PARTNER",
  "INTERNAL",
  "NODE",
]);
export type RateLimitProfile = z.infer<typeof RateLimitProfileZ>;

export const RateLimitInputZ = z.object({
  ip: z.string().min(1),
  userAgent: z.string().optional(),
  actorId: z.string().optional(),
  capsuleId: z.string().optional(),
  intent: z.string().min(1),
  profile: RateLimitProfileZ,
});
export type RateLimitInput = z.infer<typeof RateLimitInputZ>;

export const RateLimitConfigZ = z.object({
  windowSec: z.number().int().positive(),
  max: z.number().int().positive(),
  key: z.enum(["ip_fingerprint", "actor_capsule"]),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigZ>;

export const SensorResultZ = z.object({
  ok: z.literal(true),
});
export type SensorResult = z.infer<typeof SensorResultZ>;

// ============================================================================
// SIGNATURE VERIFICATION SENSOR (Detailed)
// ============================================================================

export const PassportZ = z.object({
  id: z.string(),
  public_key: z.custom<Buffer>((v) => Buffer.isBuffer(v)),
  status: z.enum(["ACTIVE", "REVOKED", "EXPIRED", "PENDING"]),
  issuedAt: z.number().int(),
  expiresAt: z.number().int().optional(),
});
export const ExecutionMetricsZ = z.object({
  dbWrites: z.number().int(),
  dbReads: z.number().int(),
  externalCalls: z.number().int(),
  elapsedMs: z.number().int().optional(),
});

export type Passport = z.infer<typeof PassportZ>;

// ============================================================================
// GENERAL SENSOR CHAIN INPUT
// ============================================================================

export const SensorChainInputZ = z.object({
  ip: z.string().min(1),
  path: z.string().min(1),
  contentLength: z.number().int().nonnegative(),
  peek: z.instanceof(Uint8Array),
  country: z.string().optional(),
});
export type SensorChainInput = z.infer<typeof SensorChainInputZ>;

// ============================================================================
// ENTROPY SENSOR
// ============================================================================

export const EntropySensorInputZ = z.object({
  pid: z.custom<Buffer>((v) => Buffer.isBuffer(v)).optional(),
  nonce: z.custom<Buffer>((v) => Buffer.isBuffer(v)).optional(),
  ip: z.string().min(1),
});
export type EntropySensorInput = z.infer<typeof EntropySensorInputZ>;

// ============================================================================
// PROTOCOL STRICT SENSOR
// ============================================================================

export const ProtocolStrictInputZ = z.object({
  rawBytes: z
    .union([
      z.custom<Buffer>((v) => Buffer.isBuffer(v)),
      z.instanceof(Uint8Array),
    ])
    .optional(),
  ip: z.string().min(1),
  path: z.string().min(1),
  contentLength: z.number().int().nonnegative(),
  peek: z.instanceof(Uint8Array),
  country: z.string().optional(),
  contentType: z.string().optional(),
});
export type ProtocolStrictInput = z.infer<typeof ProtocolStrictInputZ>;

// ============================================================================
// SCHEMA VALIDATION SENSOR
// ============================================================================

export const SchemaFieldKindZ = z.enum([
  "utf8",
  "u64",
  "bytes",
  "bytes16",
  "bool",
  "obj",
  "arr",
]);
export type SchemaFieldKind = z.infer<typeof SchemaFieldKindZ>;

export const ScopeZ = z.enum(["header", "body"]);
export type Scope = z.infer<typeof ScopeZ>;

export const SchemaFieldZ = z.object({
  name: z.string().min(1),
  tlv: z.number().int().positive(),
  kind: SchemaFieldKindZ,
  required: z.boolean().optional(),
  maxLen: z.number().int().positive().optional(),
  max: z.string().optional(),
  scope: ScopeZ.optional(),
});
export type SchemaField = z.infer<typeof SchemaFieldZ>;

export const BodyProfileZ = z.enum(["TLV_MAP", "RAW", "TLV_OBJ", "TLV_ARR"]);
export type BodyProfile = z.infer<typeof BodyProfileZ>;

export const IntentSchemaZ = z.object({
  intent: z.string().min(1),
  version: z.number().int().positive(),
  bodyProfile: BodyProfileZ,
  fields: z.array(SchemaFieldZ).min(1),
});
export type IntentSchema = z.infer<typeof IntentSchemaZ>;

// ============================================================================
// WEBSOCKET HANDSHAKE SENSOR
// ============================================================================

export const WsHandshakeInputZ = z.object({
  clientId: z.string().min(1),
  isWs: z.boolean(),
  ip: z.string().min(1),
});
export type WsHandshakeInput = z.infer<typeof WsHandshakeInputZ>;

export const WsHandshakeDecisionZ = z.union([
  z.object({ action: z.literal("ALLOW") }),
  z.object({ action: z.literal("DENY"), code: z.string() }),
]);
export type WsHandshakeDecision = z.infer<typeof WsHandshakeDecisionZ>;

// ============================================================================
// IP REPUTATION SENSOR
// ============================================================================

export const IPReputationInputZ = z.object({
  ip: z.string().min(1),
});
export type IPReputationInput = z.infer<typeof IPReputationInputZ>;

export const IPReputationZ = z.object({
  score: z.number().min(-100).max(100),
  lastUpdated: z.number().int(),
  totalRequests: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  blockedRequests: z.number().int().nonnegative(),
  tags: z.array(z.string()),
});
export type IPReputation = z.infer<typeof IPReputationZ>;

// ============================================================================
// FILE UPLOAD STATE SENSOR
// ============================================================================

export const UploadStatusZ = z.enum([
  "INIT",
  "UPLOADING",
  "FINALIZING",
  "DONE",
  "ABORTED",
]);
export type UploadStatus = z.infer<typeof UploadStatusZ>;

export const UploadSessionZ = z.object({
  uploadIdHex: z.string().min(1),
  fileName: z.string().min(1),
  totalSize: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  totalChunks: z.number().int().positive(),
  receivedCount: z.number().int().nonnegative(),
  status: UploadStatusZ,
});
export type UploadSession = z.infer<typeof UploadSessionZ>;

// ============================================================================
// BODY BUDGET SENSOR
// ============================================================================

export const BodyBudgetInputZ = z.object({
  intent: z.string().min(1),
  headerLen: z.number().int().nonnegative(),
  bodyLen: z.number().int().nonnegative(),
});
export type BodyBudgetInput = z.infer<typeof BodyBudgetInputZ>;

export const BodyBudgetPolicyZ = z.object({
  maxHeaderBytes: z.number().int().positive(),
  maxBodyBytes: z.number().int().positive(),
});
export type BodyBudgetPolicy = z.infer<typeof BodyBudgetPolicyZ>;

// ============================================================================
// CHUNK HASH SENSOR
// ============================================================================

export const ChunkHashInputZ = z.object({
  headerTLVs: z.any(), // Map<number, Uint8Array> - flexible validation for compatibility
  bodyBytes: z.any(), // Uint8Array - flexible validation for compatibility
  intent: z.string().min(1),
});
export type ChunkHashInput = z.infer<typeof ChunkHashInputZ>;

// ============================================================================
// AXIS CONTEXT (Request Context across sensors)
// ============================================================================

export enum ProofType {
  CAPSULE = 1,
  JWT = 2,
  MTLS_ID = 3,
  DEVICE_SE = 4,
  WITNESS_SIG = 5,
}

export const AxisContextZ = z.object({
  pid: z.custom<Buffer>((v) => Buffer.isBuffer(v)), // Process ID
  ts: z.bigint(), // Timestamp
  intent: z.string().min(1),
  actorId: z.custom<Buffer>((v) => Buffer.isBuffer(v)),
  proofType: z.enum(ProofType),
  proofRef: z.custom<Buffer>((v) => Buffer.isBuffer(v)),
  nonce: z.custom<Buffer>((v) => Buffer.isBuffer(v)),
  ip: z.string().min(1),
  nodeCertHash: z.string().optional(),
  capsule: CapsuleZ.optional(),
  passport: PassportZ.optional(),
  meter: z.any().optional(), // ExecutionMeter instance - any to avoid circular dependency and allow class instance
});

export type AxisContext = z.infer<typeof AxisContextZ>;

// ============================================================================
// ERROR HANDLING
// ============================================================================

export const AxisErrorZ = z.object({
  code: z.string(),
  message: z.string(),
  httpStatus: z.number().int(),
});
export type AxisError = z.infer<typeof AxisErrorZ>;
