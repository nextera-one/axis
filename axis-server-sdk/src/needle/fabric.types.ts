/**
 * Fabric — The resulting reality after stitches are woven
 *
 * Fabric is the state space — the unified projection of all threads,
 * stitches, and knots into "what is true right now."
 *
 * Thread records what happened.
 * Knot records what mattered.
 * Fabric records what IS.
 *
 * A Fabric is built by replaying all stitches in order,
 * applying their effects to produce the current world state.
 *
 * Properties:
 *   1. Deterministic — same stitches produce same fabric
 *   2. Projectable — can compute fabric at any TPS coordinate
 *   3. Verifiable — fabric hash proves state integrity
 *   4. Multi-thread — weaves all threads into one reality
 *   5. Knot-aware — knots create structural boundaries in fabric
 */

import type { Knot } from './knot.types';
import type { Stitch, Thread } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// Fabric State
// ────────────────────────────────────────────────────────────────────────────

/**
 * A single cell of state within the fabric.
 * Each cell tracks what produced it and when.
 */
export interface FabricCell {
  /** State key (e.g., "account:alice:balance", "zone:example.com:records") */
  key: string;
  /** Current value */
  value: unknown;
  /** Stitch that last wrote this cell */
  last_stitch_id: string;
  /** TPS coordinate of last write */
  last_tps?: string;
  /** How many stitches have touched this cell */
  write_count: number;
  /** Whether this cell is inside an irreversible knot */
  locked: boolean;
  /** Knot ID that locked this cell (if locked) */
  locked_by_knot?: string;
}

/**
 * The Fabric — the current state of reality.
 * Produced by weaving all stitches across all threads.
 */
export interface Fabric {
  /** Unique fabric snapshot identifier */
  fabric_id: string;

  /** SHA-256 hash of the entire fabric state (for integrity verification) */
  state_hash: string;

  /** All state cells */
  cells: Map<string, FabricCell>;

  /** Thread IDs woven into this fabric */
  thread_ids: string[];

  /** Total stitches applied */
  stitch_count: number;

  /** Total knots present */
  knot_count: number;

  /** TPS coordinate this fabric was projected at (latest stitch) */
  projected_at_tps?: string;

  /** Timestamp of fabric computation */
  computed_at: number;

  /** Sequence: monotonically increasing fabric version */
  version: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Fabric Projection
// ────────────────────────────────────────────────────────────────────────────

/**
 * A FabricEffect describes the state changes a stitch produces.
 * Handlers return this to tell the Fabric what changed.
 */
export interface FabricEffect {
  /** State mutations: key → new value (null = delete) */
  mutations: Record<string, unknown | null>;
  /** Keys this stitch read but didn't write (dependency tracking) */
  reads?: string[];
}

/**
 * Resolver function: given a stitch, return the effect it has on the fabric.
 * Used during fabric projection to convert stitches into state changes.
 */
export type FabricEffectResolver = (stitch: Stitch) => FabricEffect;

// ────────────────────────────────────────────────────────────────────────────
// Fabric Diff
// ────────────────────────────────────────────────────────────────────────────

export type FabricDiffKind = 'added' | 'modified' | 'deleted';

export interface FabricDiffEntry {
  key: string;
  kind: FabricDiffKind;
  before?: unknown;
  after?: unknown;
  caused_by_stitch?: string;
}

/**
 * Diff between two fabric states.
 */
export interface FabricDiff {
  from_fabric_id: string;
  to_fabric_id: string;
  entries: FabricDiffEntry[];
  added_count: number;
  modified_count: number;
  deleted_count: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Fabric Query
// ────────────────────────────────────────────────────────────────────────────

export interface FabricQuery {
  /** Key prefix to match (e.g., "account:alice:" returns all alice's state) */
  prefix?: string;
  /** Exact keys to retrieve */
  keys?: string[];
  /** Only return cells touched by this actor */
  actor_id?: string;
  /** Only return cells within this thread */
  thread_id?: string;
  /** Only return locked cells */
  locked_only?: boolean;
}
