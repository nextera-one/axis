/**
 * Knot Engine — Critical binding points in the Thread
 *
 * Operations:
 *   openKnot()      → start a knot (begin grouping stitches)
 *   addStitch()     → add a stitch to an open knot
 *   validateKnot()  → check if all stitches are valid and complete
 *   tieKnot()       → seal the knot (immutable from here)
 *   breakKnot()     → break a knot (requires authority for law/irreversible)
 *   forkFromKnot()  → create a new branch from a decision knot
 */

import { createHash, randomBytes } from 'crypto';
import type {
  Knot,
  KnotBreakRequest,
  KnotError,
  KnotStatus,
  KnotType,
  KnotValidationResult,
} from './knot.types';
import type { Stitch } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// Open a Knot
// ────────────────────────────────────────────────────────────────────────────

export interface OpenKnotParams {
  type: KnotType;
  thread_id: string;
  actor_id: string;
  tps_anchor?: string;
  capsule_id?: string;
  law_ref?: string;
  required_count?: number;
  all_or_nothing?: boolean;
}

/**
 * Open a new knot — begin grouping stitches into a critical binding point.
 */
export function openKnot(params: OpenKnotParams): Knot {
  const isIrreversible = params.type === 'irreversible';

  return {
    knot_id: `knot_${randomBytes(16).toString('hex')}`,
    type: params.type,
    status: 'open',
    stitch_ids: [],
    thread_id: params.thread_id,
    tps_anchor: params.tps_anchor,
    irreversible: isIrreversible,
    capsule_id: params.capsule_id,
    law_ref: params.law_ref,
    branch_ids: [],
    required_count: params.required_count,
    all_or_nothing: params.all_or_nothing ?? (params.type === 'authority' || isIrreversible),
    actor_id: params.actor_id,
    created_at: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Add Stitch to Knot
// ────────────────────────────────────────────────────────────────────────────

/**
 * Add a stitch to an open knot.
 * Returns an error string if the stitch cannot be added.
 */
export function addStitchToKnot(
  knot: Knot,
  stitch: Stitch,
): string | null {
  if (knot.status !== 'open') {
    return `Knot ${knot.knot_id} is ${knot.status}, cannot add stitches`;
  }

  if (stitch.thread_id !== knot.thread_id) {
    return `Stitch thread ${stitch.thread_id} does not match knot thread ${knot.thread_id}`;
  }

  if (knot.stitch_ids.includes(stitch.stitch_id)) {
    return `Stitch ${stitch.stitch_id} already in knot`;
  }

  // Authority knots: verify capsule matches
  if (knot.type === 'authority' && knot.capsule_id) {
    if (stitch.observation.capsuleId && stitch.observation.capsuleId !== knot.capsule_id) {
      return `Stitch capsule ${stitch.observation.capsuleId} does not match knot capsule ${knot.capsule_id}`;
    }
  }

  knot.stitch_ids.push(stitch.stitch_id);
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Validate Knot
// ────────────────────────────────────────────────────────────────────────────

/**
 * Validate a knot — check if all stitches are valid and the knot can be tied.
 */
export function validateKnot(
  knot: Knot,
  stitches: Stitch[],
): KnotValidationResult {
  const errors: KnotError[] = [];
  const passedIds: string[] = [];
  const failedIds: string[] = [];

  // Rule 2: Knot must be fully witnessed — all stitches must exist
  const stitchMap = new Map(stitches.map((s) => [s.stitch_id, s]));

  for (const sid of knot.stitch_ids) {
    const stitch = stitchMap.get(sid);
    if (!stitch) {
      failedIds.push(sid);
      errors.push({
        code: 'KNOT_MISSING_STITCH',
        message: `Stitch ${sid} not found`,
        stitch_id: sid,
      });
      continue;
    }

    // Torn stitches fail validation
    if (stitch.kind === 'torn') {
      failedIds.push(sid);
      errors.push({
        code: 'KNOT_TORN_STITCH',
        message: `Stitch ${sid} is torn (failed/disputed)`,
        stitch_id: sid,
      });
      continue;
    }

    // Rule 3: Irreversible knots require deed-level stitches (not silent)
    if (knot.type === 'irreversible' && stitch.kind !== 'deed') {
      failedIds.push(sid);
      errors.push({
        code: 'KNOT_REQUIRES_DEED',
        message: `Irreversible knot requires deed stitch, got '${stitch.kind}'`,
        stitch_id: sid,
      });
      continue;
    }

    passedIds.push(sid);
  }

  // Check minimum required count
  if (knot.required_count !== undefined && knot.stitch_ids.length < knot.required_count) {
    errors.push({
      code: 'KNOT_INSUFFICIENT_STITCHES',
      message: `Knot requires ${knot.required_count} stitches, has ${knot.stitch_ids.length}`,
    });
  }

  // all_or_nothing: if any failed, knot cannot be tied
  const allPassed = failedIds.length === 0;
  const canTie = knot.all_or_nothing
    ? allPassed && (knot.required_count === undefined || knot.stitch_ids.length >= knot.required_count)
    : passedIds.length > 0 && (knot.required_count === undefined || passedIds.length >= knot.required_count);

  return {
    valid: allPassed && errors.length === 0,
    passed_stitch_ids: passedIds,
    failed_stitch_ids: failedIds,
    can_tie: canTie,
    errors,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Tie Knot (seal it)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tie (seal) a knot — makes it immutable.
 * Computes a witness hash over all stitch receipt hashes.
 */
export function tieKnot(
  knot: Knot,
  stitches: Stitch[],
): KnotValidationResult & { knot: Knot } {
  const validation = validateKnot(knot, stitches);

  if (!validation.can_tie) {
    return { ...validation, knot };
  }

  // Compute witness hash: H(stitch_receipt_hash_1 : stitch_receipt_hash_2 : ...)
  const receiptHashes = validation.passed_stitch_ids
    .map((sid) => stitches.find((s) => s.stitch_id === sid)!)
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => s.receipt.hash);

  const witnessPayload = receiptHashes.join(':');
  knot.witness_hash = createHash('sha256')
    .update(witnessPayload)
    .digest('hex');

  knot.status = 'tied';
  knot.tied_at = Date.now();

  return { ...validation, knot };
}

// ────────────────────────────────────────────────────────────────────────────
// Break Knot
// ────────────────────────────────────────────────────────────────────────────

/**
 * Break a knot — requires authority for law/irreversible knots.
 *
 * Rule 1: Knot cannot be silently broken — must have reason + actor.
 * Rule 3: Irreversible knots require override_grant_id.
 */
export function breakKnot(
  knot: Knot,
  request: KnotBreakRequest,
): { ok: boolean; error?: string } {
  if (knot.status === 'broken') {
    return { ok: false, error: 'Knot is already broken' };
  }

  if (knot.status === 'open') {
    // Open knots can be broken by the creator
    knot.status = 'broken';
    knot.broken_at = Date.now();
    knot.break_reason = request.reason;
    return { ok: true };
  }

  // Tied knots require stronger authority
  if (knot.status === 'tied') {
    // Rule 1: Must have a reason
    if (!request.reason) {
      return { ok: false, error: 'Breaking a tied knot requires a reason' };
    }

    // Rule 3: Irreversible + law knots need override authority
    if ((knot.irreversible || knot.type === 'law') && !request.override_grant_id) {
      return {
        ok: false,
        error: `Breaking ${knot.type} knot requires override_grant_id from higher authority`,
      };
    }

    knot.status = 'broken';
    knot.broken_at = Date.now();
    knot.break_reason = request.reason;
    return { ok: true };
  }

  return { ok: false, error: `Cannot break knot in status '${knot.status}'` };
}

// ────────────────────────────────────────────────────────────────────────────
// Fork from Knot
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mark a knot as a decision/fork point and register a new branch.
 *
 * Rule 4: Forking from knot creates new branch.
 */
export function forkFromKnot(
  knot: Knot,
  branchId: string,
  decisionStitchId?: string,
): { ok: boolean; error?: string } {
  if (knot.status !== 'tied' && knot.status !== 'open') {
    return { ok: false, error: `Cannot fork from knot in status '${knot.status}'` };
  }

  if (decisionStitchId) {
    if (!knot.stitch_ids.includes(decisionStitchId)) {
      return { ok: false, error: `Decision stitch ${decisionStitchId} is not part of this knot` };
    }
    knot.decision_stitch_id = decisionStitchId;
  }

  knot.branch_ids.push(branchId);
  knot.status = 'forked';
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Query Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Check if a knot is still open and accepting stitches */
export function isKnotOpen(knot: Knot): boolean {
  return knot.status === 'open';
}

/** Check if a knot represents a point of no return */
export function isPointOfNoReturn(knot: Knot): boolean {
  return knot.irreversible && knot.status === 'tied';
}

/** Check if a stitch is part of any knot in a set */
export function findKnotsForStitch(
  stitchId: string,
  knots: Knot[],
): Knot[] {
  return knots.filter((k) => k.stitch_ids.includes(stitchId));
}

/** Get all irreversible knots in a thread */
export function getIrreversibleKnots(knots: Knot[]): Knot[] {
  return knots.filter((k) => k.irreversible && k.status === 'tied');
}

/** Get decision points (fork knots) in a thread */
export function getDecisionPoints(knots: Knot[]): Knot[] {
  return knots.filter((k) => k.type === 'decision' || k.status === 'forked');
}
