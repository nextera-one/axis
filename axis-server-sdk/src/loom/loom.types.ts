/**
 * Loom Runtime - Lawful Execution Types
 *
 * Core type definitions for the Loom execution engine.
 * Loom replaces traditional auth with "Lawful Execution":
 * - Presence: Liveness proof (replaces login/sessions)
 * - Writ: Executable intent (replaces JWT)
 * - Grant: Standing permission (replaces RBAC)
 * - Receipt: Proof of execution (hash-chained)
 */

// ============================================================================
// Presence Types (Liveness State)
// ============================================================================

export interface PresenceDeclaration {
  /** SoftID of the entity resuming presence (e.g., "~ayesh#work") */
  softid: string;
  /** Optional device metadata for scope binding */
  device_meta?: {
    fingerprint?: string;
    platform?: string;
    user_agent?: string;
  };
}

export interface PresenceChallenge {
  /** Unique challenge identifier */
  challenge_id: string;
  /** High-entropy random nonce (32-byte hex) */
  nonce: string;
  /** Server's current Unix timestamp in milliseconds (temporal anchor) */
  temporal_anchor: number;
  /** Time-to-live for response in milliseconds (default 5000ms) */
  ttl_ms: number;
  /** Challenge expiry timestamp */
  expires_at: number;
}

export interface PresenceProof {
  /** Challenge ID being answered */
  challenge_id: string;
  /** Ed25519 signature over canonical(nonce + temporal_anchor + device_meta) */
  signature: string;
  /** Public key corresponding to the SoftID */
  public_key: string;
  /** Optional key identifier */
  kid?: string;
}

export interface PresenceReceipt {
  /** Presence ID - hash of the completed handshake */
  presence_id: string;
  /** SoftID that established presence */
  softid: string;
  /** Anchor Reflection ID for logs (privacy-preserving) */
  anchor_reflection: string;
  /** Scope constraints for this presence */
  scope: {
    ip?: string;
    device_fingerprint?: string;
  };
  /** When presence was established (Unix timestamp ms) */
  issued_at: number;
  /** When presence expires (Unix timestamp ms) */
  expires_at: number;
  /** Last renewal timestamp (updated on successful Writ execution) */
  renewed_at?: number;
}

export type PresenceStatus = 'active' | 'expired' | 'revoked';

// ============================================================================
// Writ Types (Executable Intent)
// ============================================================================

export interface WritHead {
  /** Thread ID - derived from actor, groups related writs */
  tid: string;
  /** Sequence number within the thread */
  seq: number;
}

export interface WritBody {
  /** SoftID of the actor (Anchor or Shadow) */
  who: string;
  /** Operation Execution Code (e.g., "dns.write", "file.upload") */
  act: string;
  /** Resource target (e.g., "zone:example.com", "bucket:uploads") */
  res: string;
  /** Grant reference - grant_id or "self" for sovereign actions */
  law: string;
}

export interface WritMeta {
  /** Issued-at timestamp (Unix seconds) */
  iat: number;
  /** Expiry timestamp (Unix seconds) */
  exp: number;
  /** Previous receipt hash (thread continuity) - empty string for first writ */
  prev: string;
}

export interface WritSignature {
  /** Signature algorithm */
  alg: 'ed25519';
  /** Base64-encoded signature value */
  value: string;
  /** Optional key identifier */
  kid?: string;
}

export interface Writ {
  head: WritHead;
  body: WritBody;
  meta: WritMeta;
  sig: WritSignature;
}

// ============================================================================
// Grant Types (Standing Permission / Law)
// ============================================================================

export type GrantType = 'sovereign' | 'delegated' | 'system';

export interface GrantCapability {
  /** Operation Execution Code this grant allows */
  oec: string;
  /** Resource scope constraint (e.g., "zone:*.example.com") */
  scope: string;
  /** Optional quantitative limits */
  limit?: {
    /** Rate limit (e.g., "10/min", "100/day") */
    rate?: string;
    /** Maximum amount/count */
    amount?: number;
    /** Depth constraint (e.g., "subdomains_only") */
    depth?: string;
  };
}

export interface GrantMeta {
  /** Issued-at timestamp (Unix seconds) */
  iat: number;
  /** Expiry timestamp (Unix seconds) */
  exp: number;
  /** Whether this grant can be revoked */
  revocable: boolean;
  /** Version number for updates */
  version: number;
  /** Optional Digital Fabric contract reference */
  contract_ref?: string;
}

export interface Grant {
  /** Unique grant identifier */
  grant_id: string;
  /** SoftID of the authority who issued this grant */
  issuer: string;
  /** SoftID of the grantee */
  subject: string;
  /** Grant type */
  grant_type: GrantType;
  /** Array of capabilities this grant provides */
  caps: GrantCapability[];
  /** Grant metadata */
  meta: GrantMeta;
  /** Signature over the grant */
  sig: WritSignature;
}

export type GrantStatus = 'active' | 'revoked' | 'expired';

// ============================================================================
// Receipt Types (Proof of Execution)
// ============================================================================

export interface LoomReceipt {
  /** Receipt ID */
  receipt_id: string;
  /** Hash of the writ that was executed */
  writ_hash: string;
  /** Thread ID */
  thread_id: string;
  /** Sequence number */
  sequence: number;
  /** Execution effect (e.g., "ALLOW", "DENY") */
  effect: string;
  /** Current receipt hash (for chaining) */
  hash: string;
  /** Previous receipt hash */
  prev_hash: string | null;
  /** Execution timestamp */
  executed_at: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Thread Types (Causal Continuity)
// ============================================================================

export interface ThreadState {
  /** Thread ID */
  thread_id: string;
  /** SoftID that owns this thread */
  softid: string;
  /** Hash of the last receipt in this thread */
  last_receipt_hash: string;
  /** Current sequence number */
  sequence: number;
  /** Last update timestamp */
  updated_at: number;
}

// ============================================================================
// Revocation Types (Null-Receipts)
// ============================================================================

export type RevocationTargetType = 'grant' | 'presence' | 'softid';

export interface Revocation {
  /** Revocation ID */
  revocation_id: string;
  /** What type of entity is being revoked */
  target_type: RevocationTargetType;
  /** ID of the entity being revoked */
  target_id: string;
  /** SoftID of the issuer of this revocation */
  issuer_softid: string;
  /** Reason for revocation */
  reason?: string;
  /** When revocation takes effect (Unix timestamp) */
  effective_at: number;
  /** Signature over the revocation */
  sig_value: string;
}

// ============================================================================
// Validation Result Types
// ============================================================================

export interface LoomValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface PresenceVerifyResult extends LoomValidationResult {
  presence?: PresenceReceipt;
}

export interface WritValidationResult extends LoomValidationResult {
  writ?: Writ;
  gate_failed?: 'temporal' | 'causal' | 'legal' | 'authentic';
}

export interface GrantValidationResult extends LoomValidationResult {
  grant?: Grant;
}

// ============================================================================
// TLV Constants (re-exported from core/constants.ts for convenience)
// ============================================================================

export {
  TLV_LOOM_PRESENCE_ID as TLV_PRESENCE_ID,
  TLV_LOOM_WRIT as TLV_WRIT,
  TLV_LOOM_THREAD_HASH as TLV_THREAD_HASH,
  PROOF_LOOM,
} from '../core/constants';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Derive Anchor Reflection ID (ARID) for privacy-preserving logs.
 * ARID = hash(anchor_pubkey + context + scope)
 */
export function deriveAnchorReflection(
  softid: string,
  context: string = 'openlogs',
  scope: string = 'loom',
): string {
  // Implementation will use crypto hash
  // Placeholder structure: ar:<context>:<scope>:<hash>
  return `ar:${context}:${scope}:${softid}`;
}

/**
 * Canonicalize a Writ for signing/verification.
 * Returns deterministic JSON string.
 */
export function canonicalizeWrit(writ: Omit<Writ, 'sig'>): string {
  const ordered = {
    head: { tid: writ.head.tid, seq: writ.head.seq },
    body: {
      who: writ.body.who,
      act: writ.body.act,
      res: writ.body.res,
      law: writ.body.law,
    },
    meta: { iat: writ.meta.iat, exp: writ.meta.exp, prev: writ.meta.prev },
  };
  return JSON.stringify(ordered);
}

/**
 * Canonicalize a Grant for signing/verification.
 */
export function canonicalizeGrant(grant: Omit<Grant, 'sig'>): string {
  const ordered = {
    grant_id: grant.grant_id,
    issuer: grant.issuer,
    subject: grant.subject,
    grant_type: grant.grant_type,
    caps: grant.caps,
    meta: grant.meta,
  };
  return JSON.stringify(ordered);
}
