/**
 * Knot — Critical binding points in the Thread
 *
 * A Knot is where multiple stitches converge and become inseparable
 * due to dependency, authority, or consequence.
 *
 *   Stitch = one action
 *   Thread = sequence of actions
 *   Knot   = critical point that ties multiple actions together
 *
 * Thread shows what happened.
 * Knot shows what mattered.
 *
 * Rules:
 *   1. Knot cannot be silently broken
 *   2. Knot must be fully witnessed
 *   3. Irreversible knots require strict validation
 *   4. Forking from a knot creates a new branch
 */

import type { Stitch } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// Knot Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Authority:     Multiple actions bound under one capsule / approval
 * Law:           Actions tied by legal consequence
 * Causal:        Actions that depend on each other sequentially
 * Decision:      Fork point where different futures emerge
 * Irreversible:  Point of no return — cannot be undone
 */
export type KnotType =
  | 'authority'
  | 'law'
  | 'causal'
  | 'decision'
  | 'irreversible';

export type KnotStatus =
  | 'open'         // Knot is still forming (accepting stitches)
  | 'tied'         // Knot is complete and sealed
  | 'broken'       // Knot was broken (override, failure, revocation)
  | 'forked';      // Knot became a branch point

// ────────────────────────────────────────────────────────────────────────────
// Knot
// ────────────────────────────────────────────────────────────────────────────

export interface Knot {
  /** Unique knot identifier */
  knot_id: string;

  /** What kind of binding this knot represents */
  type: KnotType;

  /** Current state */
  status: KnotStatus;

  /** Stitch IDs that form this knot */
  stitch_ids: string[];

  /** Thread this knot belongs to */
  thread_id: string;

  /** TPS coordinate that anchors this knot in time */
  tps_anchor?: string;

  /** Whether this knot represents a point of no return */
  irreversible: boolean;

  // ── Binding context ──

  /** Capsule that authorizes this group (authority knots) */
  capsule_id?: string;

  /** DFL law coordinate that governs this knot (law knots) */
  law_ref?: string;

  /** The stitch that is the decision point (decision knots) */
  decision_stitch_id?: string;

  /** Branch IDs spawned from this knot (decision/fork knots) */
  branch_ids: string[];

  // ── Constraints ──

  /** Minimum stitches required to tie this knot */
  required_count?: number;

  /** Whether all stitches must succeed for the knot to hold */
  all_or_nothing: boolean;

  // ── Metadata ──

  /** Actor who initiated this knot */
  actor_id: string;

  /** When the knot was created (opened) */
  created_at: number;

  /** When the knot was tied (sealed) */
  tied_at?: number;

  /** When the knot was broken (if broken) */
  broken_at?: number;

  /** Reason for breaking, if applicable */
  break_reason?: string;

  /** Witness hash covering all stitch receipts in this knot */
  witness_hash?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Knot Validation
// ────────────────────────────────────────────────────────────────────────────

export interface KnotValidationResult {
  valid: boolean;
  /** Which stitches passed */
  passed_stitch_ids: string[];
  /** Which stitches failed or are missing */
  failed_stitch_ids: string[];
  /** Whether the knot can be tied given current stitches */
  can_tie: boolean;
  /** Errors */
  errors: KnotError[];
}

export interface KnotError {
  code: string;
  message: string;
  stitch_id?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Knot Break Request
// ────────────────────────────────────────────────────────────────────────────

export interface KnotBreakRequest {
  /** Knot to break */
  knot_id: string;
  /** Who is breaking it */
  actor_id: string;
  /** Why it's being broken */
  reason: string;
  /** Authority override (required for law/irreversible knots) */
  override_grant_id?: string;
  /** Signature proving authority */
  signature?: string;
}
