/**
 * Loom Runtime Engine
 *
 * Implements the full Loom execution lifecycle:
 * - Presence: challenge → proof → receipt (replaces login/sessions)
 * - Writ: creation → validation → execution (replaces JWT)
 * - Grant: resolution → capability matching (replaces RBAC)
 * - Receipt: hash-chained proof of execution
 * - Revocation: null-receipt revocation of grants/presence
 */

import { createHash, randomBytes } from 'crypto';
import { sign, verify } from 'tweetnacl';

import type {
  Grant,
  GrantCapability,
  GrantStatus,
  GrantValidationResult,
  LoomReceipt,
  PresenceChallenge,
  PresenceDeclaration,
  PresenceProof,
  PresenceReceipt,
  PresenceStatus,
  PresenceVerifyResult,
  Revocation,
  ThreadState,
  Writ,
  WritBody,
  WritHead,
  WritMeta,
  WritSignature,
  WritValidationResult,
} from './loom.types';
import { canonicalizeGrant, canonicalizeWrit } from './loom.types';

// ────────────────────────────────────────────────────────────────────────────
// Crypto helpers
// ────────────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hexToUint8(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function uint8ToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function b64ToUint8(b64: string): Uint8Array {
  const bin = Buffer.from(b64, 'base64');
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength);
}

function uint8ToB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

// ────────────────────────────────────────────────────────────────────────────
// Presence Engine
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_PRESENCE_TTL_MS = 5_000;
const DEFAULT_PRESENCE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Create a challenge for a presence declaration.
 */
export function createPresenceChallenge(
  declaration: PresenceDeclaration,
  ttlMs: number = DEFAULT_PRESENCE_TTL_MS,
): PresenceChallenge {
  const now = Date.now();
  const nonce = randomBytes(32).toString('hex');
  const challengeId = sha256(`${declaration.softid}:${nonce}:${now}`);

  return {
    challenge_id: challengeId,
    nonce,
    temporal_anchor: now,
    ttl_ms: ttlMs,
    expires_at: now + ttlMs,
  };
}

/**
 * Canonical data for presence challenge signing.
 */
function presenceSigningData(
  challenge: PresenceChallenge,
  deviceMeta?: PresenceDeclaration['device_meta'],
): string {
  return JSON.stringify({
    nonce: challenge.nonce,
    temporal_anchor: challenge.temporal_anchor,
    device_meta: deviceMeta ?? null,
  });
}

/**
 * Sign a presence challenge with a private key.
 */
export function signPresenceChallenge(
  challenge: PresenceChallenge,
  privateKeyHex: string,
  publicKeyHex: string,
  declaration: PresenceDeclaration,
  kid?: string,
): PresenceProof {
  const data = presenceSigningData(challenge, declaration.device_meta);
  const msgBytes = new TextEncoder().encode(data);
  const secretKey = hexToUint8(privateKeyHex);
  const signature = sign.detached(msgBytes, secretKey);

  return {
    challenge_id: challenge.challenge_id,
    signature: uint8ToHex(signature),
    public_key: publicKeyHex,
    kid,
  };
}

/**
 * Verify a presence proof and issue a receipt.
 */
export function verifyPresenceProof(
  challenge: PresenceChallenge,
  proof: PresenceProof,
  declaration: PresenceDeclaration,
  durationMs: number = DEFAULT_PRESENCE_DURATION_MS,
): PresenceVerifyResult {
  // 1. Challenge expiry
  if (Date.now() > challenge.expires_at) {
    return { valid: false, error: 'Challenge expired', code: 'CHALLENGE_EXPIRED' };
  }

  // 2. Challenge ID match
  if (proof.challenge_id !== challenge.challenge_id) {
    return { valid: false, error: 'Challenge ID mismatch', code: 'CHALLENGE_MISMATCH' };
  }

  // 3. Verify signature
  const data = presenceSigningData(challenge, declaration.device_meta);
  const msgBytes = new TextEncoder().encode(data);
  const sigBytes = hexToUint8(proof.signature);
  const pubBytes = hexToUint8(proof.public_key);

  let isValid: boolean;
  try {
    isValid = sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return { valid: false, error: 'Signature verification failed', code: 'SIG_INVALID' };
  }

  if (!isValid) {
    return { valid: false, error: 'Invalid signature', code: 'SIG_INVALID' };
  }

  // 4. Build presence receipt
  const now = Date.now();
  const presenceId = sha256(
    `${proof.public_key}:${challenge.nonce}:${challenge.temporal_anchor}`,
  );
  const anchorReflection = sha256(
    `ar:openlogs:loom:${proof.public_key}`,
  );

  const receipt: PresenceReceipt = {
    presence_id: presenceId,
    softid: declaration.softid,
    anchor_reflection: anchorReflection,
    scope: {
      device_fingerprint: declaration.device_meta?.fingerprint,
    },
    issued_at: now,
    expires_at: now + durationMs,
  };

  return { valid: true, presence: receipt };
}

/**
 * Check if a presence receipt is currently active.
 */
export function getPresenceStatus(receipt: PresenceReceipt): PresenceStatus {
  const now = Date.now();
  if (now > receipt.expires_at) return 'expired';
  return 'active';
}

/**
 * Renew presence (extend expiry).
 */
export function renewPresence(
  receipt: PresenceReceipt,
  extensionMs: number = DEFAULT_PRESENCE_DURATION_MS,
): PresenceReceipt {
  const now = Date.now();
  return {
    ...receipt,
    renewed_at: now,
    expires_at: now + extensionMs,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Writ Engine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a new Writ (executable intent).
 */
export function createWrit(
  body: WritBody,
  meta: Omit<WritMeta, 'prev'>,
  thread: { tid: string; seq: number; prevHash: string },
  privateKeyHex: string,
  kid?: string,
): Writ {
  const head: WritHead = { tid: thread.tid, seq: thread.seq };
  const writMeta: WritMeta = { ...meta, prev: thread.prevHash };

  const unsigned: Omit<Writ, 'sig'> = { head, body, meta: writMeta };
  const canonical = canonicalizeWrit(unsigned);
  const msgBytes = new TextEncoder().encode(canonical);
  const secretKey = hexToUint8(privateKeyHex);
  const signature = sign.detached(msgBytes, secretKey);

  const sig: WritSignature = {
    alg: 'ed25519',
    value: uint8ToB64(signature),
    kid,
  };

  return { head, body, meta: writMeta, sig };
}

/**
 * Validate a Writ through all four gates:
 * 1. Temporal: is the writ within its time window?
 * 2. Causal: does the prev hash match the thread state?
 * 3. Legal: does a valid grant allow this operation?
 * 4. Authentic: is the signature valid?
 */
export function validateWrit(
  writ: Writ,
  publicKeyHex: string,
  threadState: ThreadState | null,
  grants: Grant[],
): WritValidationResult {
  const now = Math.floor(Date.now() / 1000);

  // Gate 1: Temporal
  if (now < writ.meta.iat) {
    return {
      valid: false,
      error: 'Writ not yet valid (iat in future)',
      code: 'TEMPORAL_NOT_YET',
      gate_failed: 'temporal',
    };
  }
  if (now > writ.meta.exp) {
    return {
      valid: false,
      error: 'Writ expired',
      code: 'TEMPORAL_EXPIRED',
      gate_failed: 'temporal',
    };
  }

  // Gate 2: Causal (thread continuity)
  if (threadState) {
    if (writ.head.tid !== threadState.thread_id) {
      return {
        valid: false,
        error: 'Thread ID mismatch',
        code: 'CAUSAL_TID',
        gate_failed: 'causal',
      };
    }
    if (writ.head.seq !== threadState.sequence + 1) {
      return {
        valid: false,
        error: `Expected seq ${threadState.sequence + 1}, got ${writ.head.seq}`,
        code: 'CAUSAL_SEQ',
        gate_failed: 'causal',
      };
    }
    if (writ.meta.prev !== threadState.last_receipt_hash) {
      return {
        valid: false,
        error: 'Previous receipt hash mismatch',
        code: 'CAUSAL_PREV',
        gate_failed: 'causal',
      };
    }
  } else {
    // First writ in thread
    if (writ.head.seq !== 1) {
      return {
        valid: false,
        error: 'First writ in thread must have seq=1',
        code: 'CAUSAL_FIRST_SEQ',
        gate_failed: 'causal',
      };
    }
    if (writ.meta.prev !== '') {
      return {
        valid: false,
        error: 'First writ must have empty prev hash',
        code: 'CAUSAL_FIRST_PREV',
        gate_failed: 'causal',
      };
    }
  }

  // Gate 3: Legal (grant matching)
  if (writ.body.law !== 'self') {
    const matchingGrant = grants.find((g) =>
      g.grant_id === writ.body.law &&
      g.subject === writ.body.who &&
      grantCoversAction(g, writ.body.act, writ.body.res, now),
    );
    if (!matchingGrant) {
      return {
        valid: false,
        error: `No valid grant found for law=${writ.body.law}`,
        code: 'LEGAL_NO_GRANT',
        gate_failed: 'legal',
      };
    }
  }

  // Gate 4: Authentic (signature verification)
  const unsigned: Omit<Writ, 'sig'> = {
    head: writ.head,
    body: writ.body,
    meta: writ.meta,
  };
  const canonical = canonicalizeWrit(unsigned);
  const msgBytes = new TextEncoder().encode(canonical);
  const sigBytes = b64ToUint8(writ.sig.value);
  const pubBytes = hexToUint8(publicKeyHex);

  let sigValid: boolean;
  try {
    sigValid = sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return {
      valid: false,
      error: 'Signature verification failed',
      code: 'AUTH_SIG_FAIL',
      gate_failed: 'authentic',
    };
  }

  if (!sigValid) {
    return {
      valid: false,
      error: 'Invalid signature',
      code: 'AUTH_SIG_INVALID',
      gate_failed: 'authentic',
    };
  }

  return { valid: true, writ };
}

// ────────────────────────────────────────────────────────────────────────────
// Grant Engine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a grant covers a specific action on a specific resource.
 */
export function grantCoversAction(
  grant: Grant,
  action: string,
  resource: string,
  nowUnix: number,
): boolean {
  // Check temporal validity
  if (nowUnix < grant.meta.iat || nowUnix > grant.meta.exp) {
    return false;
  }

  // Check capabilities
  return grant.caps.some((cap) =>
    matchOec(cap.oec, action) && matchScope(cap.scope, resource),
  );
}

/**
 * Match an Operation Execution Code pattern against an action.
 * Supports wildcards: "dns.*" matches "dns.write", "dns.read", etc.
 */
function matchOec(pattern: string, action: string): boolean {
  if (pattern === '*') return true;
  if (pattern === action) return true;

  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return action.startsWith(prefix + '.');
  }

  return false;
}

/**
 * Match a scope pattern against a resource.
 * Supports wildcards: "zone:*.example.com" matches "zone:sub.example.com"
 */
function matchScope(pattern: string, resource: string): boolean {
  if (pattern === '*') return true;
  if (pattern === resource) return true;

  // Simple wildcard matching
  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^:]*') + '$',
    );
    return regex.test(resource);
  }

  return false;
}

/**
 * Get grant status based on current time and revocation state.
 */
export function getGrantStatus(
  grant: Grant,
  revocations: Revocation[],
): GrantStatus {
  const now = Math.floor(Date.now() / 1000);

  // Check revocation
  const revoked = revocations.find(
    (r) => r.target_type === 'grant' && r.target_id === grant.grant_id,
  );
  if (revoked && revoked.effective_at <= now * 1000) {
    return 'revoked';
  }

  // Check expiry
  if (now > grant.meta.exp) return 'expired';

  return 'active';
}

/**
 * Validate a grant's signature.
 */
export function validateGrant(
  grant: Grant,
  issuerPublicKeyHex: string,
): GrantValidationResult {
  const unsigned: Omit<Grant, 'sig'> = {
    grant_id: grant.grant_id,
    issuer: grant.issuer,
    subject: grant.subject,
    grant_type: grant.grant_type,
    caps: grant.caps,
    meta: grant.meta,
  };
  const canonical = canonicalizeGrant(unsigned);
  const msgBytes = new TextEncoder().encode(canonical);
  const sigBytes = b64ToUint8(grant.sig.value);
  const pubBytes = hexToUint8(issuerPublicKeyHex);

  let valid: boolean;
  try {
    valid = sign.detached.verify(msgBytes, sigBytes, pubBytes);
  } catch {
    return { valid: false, error: 'Grant signature verification failed', code: 'GRANT_SIG_FAIL' };
  }

  if (!valid) {
    return { valid: false, error: 'Invalid grant signature', code: 'GRANT_SIG_INVALID' };
  }

  return { valid: true, grant };
}

/**
 * Create and sign a new Grant.
 */
export function createGrant(
  grantId: string,
  issuer: string,
  subject: string,
  grantType: Grant['grant_type'],
  caps: GrantCapability[],
  meta: Grant['meta'],
  privateKeyHex: string,
  kid?: string,
): Grant {
  const unsigned: Omit<Grant, 'sig'> = {
    grant_id: grantId,
    issuer,
    subject,
    grant_type: grantType,
    caps,
    meta,
  };

  const canonical = canonicalizeGrant(unsigned);
  const msgBytes = new TextEncoder().encode(canonical);
  const secretKey = hexToUint8(privateKeyHex);
  const signature = sign.detached(msgBytes, secretKey);

  return {
    ...unsigned,
    sig: {
      alg: 'ed25519',
      value: uint8ToB64(signature),
      kid,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Receipt Engine (hash-chained proof of execution)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a hash-chained receipt for a writ execution.
 */
export function createReceipt(
  writ: Writ,
  effect: string,
  prevReceipt: LoomReceipt | null,
  metadata?: Record<string, unknown>,
): LoomReceipt {
  const now = Date.now();
  const sequence = prevReceipt ? prevReceipt.sequence + 1 : 1;
  const prevHash = prevReceipt?.hash ?? null;

  // Hash the writ
  const writHash = sha256(canonicalizeWrit({
    head: writ.head,
    body: writ.body,
    meta: writ.meta,
  }));

  // Build receipt hash (chain integrity)
  const hashInput = [
    prevHash ?? '',
    writHash,
    writ.head.tid,
    String(sequence),
    effect,
    String(now),
  ].join(':');

  const receiptHash = sha256(hashInput);
  const receiptId = sha256(`receipt:${receiptHash}:${now}`);

  return {
    receipt_id: receiptId,
    writ_hash: writHash,
    thread_id: writ.head.tid,
    sequence,
    effect,
    hash: receiptHash,
    prev_hash: prevHash,
    executed_at: now,
    metadata,
  };
}

/**
 * Verify receipt chain integrity.
 */
export function verifyReceiptChain(receipts: LoomReceipt[]): {
  valid: boolean;
  brokenAt?: number;
  error?: string;
} {
  if (receipts.length === 0) return { valid: true };

  // Sort by sequence
  const sorted = [...receipts].sort((a, b) => a.sequence - b.sequence);

  // First receipt must have null prev_hash
  if (sorted[0].prev_hash !== null) {
    return {
      valid: false,
      brokenAt: 0,
      error: 'First receipt must have null prev_hash',
    };
  }

  // Verify chain continuity
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].prev_hash !== sorted[i - 1].hash) {
      return {
        valid: false,
        brokenAt: i,
        error: `Receipt ${i} prev_hash does not match receipt ${i - 1} hash`,
      };
    }
  }

  return { valid: true };
}

/**
 * Update thread state after receipt creation.
 */
export function updateThreadState(
  receipt: LoomReceipt,
  softid: string,
): ThreadState {
  return {
    thread_id: receipt.thread_id,
    softid,
    last_receipt_hash: receipt.hash,
    sequence: receipt.sequence,
    updated_at: receipt.executed_at,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Revocation Engine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a revocation record.
 */
export function createRevocation(
  targetType: Revocation['target_type'],
  targetId: string,
  issuerSoftid: string,
  privateKeyHex: string,
  reason?: string,
): Revocation {
  const now = Date.now();
  const revocationId = sha256(`revoke:${targetType}:${targetId}:${now}`);

  const payload = JSON.stringify({
    revocation_id: revocationId,
    target_type: targetType,
    target_id: targetId,
    issuer_softid: issuerSoftid,
    effective_at: now,
    reason: reason ?? null,
  });

  const msgBytes = new TextEncoder().encode(payload);
  const secretKey = hexToUint8(privateKeyHex);
  const signature = sign.detached(msgBytes, secretKey);

  return {
    revocation_id: revocationId,
    target_type: targetType,
    target_id: targetId,
    issuer_softid: issuerSoftid,
    reason,
    effective_at: now,
    sig_value: uint8ToHex(signature),
  };
}

/**
 * Check if a target has been revoked.
 */
export function isRevoked(
  targetType: Revocation['target_type'],
  targetId: string,
  revocations: Revocation[],
): boolean {
  const now = Date.now();
  return revocations.some(
    (r) =>
      r.target_type === targetType &&
      r.target_id === targetId &&
      r.effective_at <= now,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Full Loom Pipeline
// ────────────────────────────────────────────────────────────────────────────

export interface LoomExecutionResult {
  receipt: LoomReceipt;
  threadState: ThreadState;
  writValidation: WritValidationResult;
}

/**
 * Execute a full Loom pipeline:
 * 1. Validate presence
 * 2. Validate writ (4 gates)
 * 3. Create receipt
 * 4. Update thread state
 */
export function executeLoomPipeline(
  writ: Writ,
  publicKeyHex: string,
  presence: PresenceReceipt,
  threadState: ThreadState | null,
  grants: Grant[],
  revocations: Revocation[],
  prevReceipt: LoomReceipt | null,
): LoomExecutionResult | { valid: false; error: string; code: string } {
  // 1. Check presence
  const presenceStatus = getPresenceStatus(presence);
  if (presenceStatus !== 'active') {
    return { valid: false, error: 'Presence not active', code: 'PRESENCE_INACTIVE' };
  }

  // 2. Check presence revocation
  if (isRevoked('presence', presence.presence_id, revocations)) {
    return { valid: false, error: 'Presence revoked', code: 'PRESENCE_REVOKED' };
  }

  // 3. Filter out revoked grants
  const activeGrants = grants.filter(
    (g) => getGrantStatus(g, revocations) === 'active',
  );

  // 4. Validate writ
  const writResult = validateWrit(writ, publicKeyHex, threadState, activeGrants);
  if (!writResult.valid) {
    return { valid: false, error: writResult.error!, code: writResult.code! };
  }

  // 5. Create receipt
  const receipt = createReceipt(writ, 'ALLOW', prevReceipt);

  // 6. Update thread state
  const newThreadState = updateThreadState(receipt, writ.body.who);

  return {
    receipt,
    threadState: newThreadState,
    writValidation: writResult,
  };
}
