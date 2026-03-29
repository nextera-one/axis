/**
 * AXIS Cryptographic Types
 * Ed25519 signature system for packets and capsules
 */

export type AxisAlg = 'EdDSA' | 'ES256' | 'RS256';

export type CapsuleStatus = 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';
export type CapsuleMode = 'SINGLE_USE' | 'MULTI_USE';

export type KeyStatus = 'ACTIVE' | 'GRACE' | 'REVOKED' | 'RETIRED';

/**
 * Signature envelope for packets and capsules
 */
export interface AxisSig {
  alg: AxisAlg;
  kid: string; // Key identifier
  value: string; // base64url signature
}

/**
 * AXIS packet structure (client → server)
 */
export interface AxisPacket<T = any> {
  v: 1;
  pid: string; // Packet ID for tracing
  nonce: string; // Anti-replay nonce
  ts: number; // Unix timestamp (seconds)
  actorId: string; // Actor identifier
  opcode: string; // Operation code (e.g., CAPSULE.ISSUE, INTENT.EXEC)
  body: T; // Opcode-specific payload
  sig: AxisSig; // Actor signature over packet (excluding sig itself)
}

/**
 * Capsule constraints for execution context
 */
export interface AxisCapsuleConstraints {
  // Hard limits
  maxAmount?: number;
  maxCount?: number;
  ttlSeconds?: number;

  // Context locks
  ipCidrAllow?: string[]; // ["1.2.3.0/24"]
  countryAllow?: string[]; // ["JO", "SA"]
  deviceIdAllow?: string[]; // Device fingerprints
  sessionIdLock?: string; // Bind to specific session
  nonceRequired?: boolean; // Require per-execution nonce
}

/**
 * TickAuth time window for temporal binding
 */
export interface TickWindow {
  start: number; // Unix timestamp
  end: number; // Unix timestamp
}

/**
 * Capsule payload (what gets signed by issuer)
 */
export interface AxisCapsulePayload {
  v: 1;

  // Identity binding
  capsuleId: string; // ULID or UUID
  actorId: string; // Who this capsule belongs to
  issuer: string; // Who issued it
  audience: string; // Who may accept it
  subject?: string; // Optional target entity

  // Intent binding
  intent: string; // Single intent (e.g., "PAYMENT_CREATE")
  scopes: string[]; // Fine-grained resources ["wallet:123", "merchant:77"]
  actions?: string[]; // Optional action verbs ["create", "approve"]

  // Time/window
  iat: number; // Issued at (unix seconds)
  nbf?: number; // Not before (unix seconds)
  exp: number; // Expires at (unix seconds)
  tickWindow?: TickWindow; // Optional TickAuth temporal window

  // Usage control
  mode: CapsuleMode;
  maxUses: number; // 1 for SINGLE_USE
  nonceSeed?: string; // Optional server nonce seed

  // Policy linkage
  policyRefs?: string[]; // ["policy:transfer:v3", "risk:geo:v1"]
  riskScore?: number; // Risk snapshot at issuance

  // Constraints
  constraints?: AxisCapsuleConstraints;

  // Optional metadata (never trusted for auth decisions)
  meta?: Record<string, unknown>;
}

/**
 * Complete capsule (payload + issuer signature)
 */
export interface AxisCapsule {
  payload: AxisCapsulePayload;
  sig: AxisSig; // Issuer signature over canonical payload
}

/**
 * Capsule issuance request body (CAPSULE.ISSUE opcode)
 */
export interface CapsuleIssueBody {
  intent: string;
  audience: string;
  scopes: string[];
  subject?: string;
  mode: CapsuleMode;
  maxUses?: number;
  expSeconds?: number; // Server will clamp (e.g., 30-120)
  constraints?: AxisCapsuleConstraints;
  hints?: {
    // Optional client hints (not trusted)
    ip?: string;
    ua?: string;
    deviceId?: string;
    geo?: string;
  };
}

/**
 * Batch capsule issuance request (CAPSULE.BATCH opcode)
 */
export interface CapsuleBatchBody extends Omit<
  CapsuleIssueBody,
  'mode' | 'maxUses'
> {
  count: number; // Number of capsules to issue
  mode: 'SINGLE_USE'; // Batch typically single-use
}

/**
 * Intent execution request (INTENT.EXEC opcode)
 */
export interface IntentExecBody {
  intent: string;
  capsule: AxisCapsule; // Attached capsule
  execNonce?: string; // Required if capsule.constraints.nonceRequired
  args: Record<string, any>; // Intent-specific arguments
}

/**
 * Capsule revocation request (CAPSULE.REVOKE opcode)
 */
export interface CapsuleRevokeBody {
  capsuleId: string;
  reason: string;
}

/**
 * AXIS response envelope
 */
export interface AxisResponse<T = any> {
  ok: boolean;
  pid: string; // Echoes request pid
  decisionId: string; // AXIS decision trace id
  code: string; // AXIS error/success code
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

/**
 * Capsule issuance result
 */
export interface CapsuleIssueResult {
  capsule: AxisCapsule;
}

/**
 * Batch capsule issuance result
 */
export interface CapsuleBatchResult {
  capsules: AxisCapsule[];
}

/**
 * Actor key record (from DB)
 */
export interface ActorKeyRecord {
  id: Buffer;
  actor_id: string;
  key_id: string;
  algorithm: string;
  public_key: Buffer;
  purpose: string;
  status: KeyStatus;
  is_primary: boolean;
  not_before: Date | null;
  expires_at: Date | null;
  rotated_from_key_id: string | null;
  revoked_at: Date | null;
  revocation_reason: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * Issuer key record (from DB)
 */
export interface IssuerKeyRecord {
  id: Buffer;
  kid: string;
  issuer_id: string;
  alg: string;
  public_key_pem: string;
  status: KeyStatus;
  not_before: Date | null;
  not_after: Date | null;
  fingerprint: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

/**
 * Capsule record (from DB)
 */
export interface CapsuleRecord {
  id: Buffer;
  capsule_id: string;
  actor_id: string;
  intent: string;
  audience: string;
  issuer: string;
  subject: string | null;
  status: CapsuleStatus;
  mode: CapsuleMode;
  max_uses: number;
  used_count: number;
  iat: Date;
  nbf: Date | null;
  exp: Date;
  scopes_json: any;
  constraints_json: any;
  policy_refs_json: any;
  risk_score: number | null;
  payload_hash: Buffer;
  sig_alg: string;
  sig_kid: string;
  sig_value: Buffer;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
}
