/**
 * Needle & Thread — Core Metaphor Types
 *
 * Needle: The execution carrier that penetrates reality at a specific
 *         TPS moment to perform an intent. It is the live action.
 *
 * Thread: The continuous chain of witnessed events that preserves
 *         the history of actions across time. It is the memory.
 *
 * Stitch: A completed, observed, and verified action (deed).
 *         Needle (execution) + Observer (verification) = Stitch.
 *
 * Fabric: Reality / state space — what stitches are woven into.
 *
 * Formula:
 *   Intent → Needle enters (AXIS) → Action happens →
 *   Observer verifies → Stitch is formed → Thread grows
 */

import type { CompiledIntent } from '../idel/idel.types';
import type {
  Grant,
  LoomReceipt,
  PresenceReceipt,
  ThreadState,
  Writ,
} from '../loom/loom.types';
import type { AxisObservation } from '../engine/axis-observation';
import type { TruthVerdict } from '../engine/observation/truth-scoring';
import type { TimelineEvent } from '../timeline/timeline.types';

// ────────────────────────────────────────────────────────────────────────────
// Needle — The execution carrier (live action)
// ────────────────────────────────────────────────────────────────────────────

export type NeedlePhase =
  | 'created'      // Needle assembled, not yet entered
  | 'validated'    // Passed through Loom gates
  | 'executing'    // Inside AXIS handler
  | 'observed'     // Observer has witnessed result
  | 'stitched'     // Stitch formed, thread updated
  | 'failed';      // Broke during any phase

/**
 * The Needle is the unified execution context that carries an intent
 * through the full AXIS pipeline: IDEL → Loom → Execution → Observation → Stitch
 */
export interface Needle {
  /** Unique needle identifier */
  needle_id: string;

  /** Current lifecycle phase */
  phase: NeedlePhase;

  /** TPS coordinate at which this needle enters reality */
  tps_coordinate?: string;

  // ── What the needle carries ──

  /** Compiled intent (from IDEL) */
  intent: CompiledIntent;

  /** Loom presence proof for the actor */
  presence: PresenceReceipt;

  /** Writ — the executable intent in Loom form */
  writ: Writ;

  /** Active grants that authorize this action */
  grants: Grant[];

  // ── What the needle produces ──

  /** Observation — filled after execution */
  observation?: AxisObservation;

  /** Loom receipt — filled after stitch */
  receipt?: LoomReceipt;

  /** Truth verdict — filled after observation scoring */
  verdict?: TruthVerdict;

  // ── Metadata ──

  /** Timestamp when needle was created */
  created_at: number;

  /** Timestamp when needle completed (stitched or failed) */
  completed_at?: number;

  /** Error if needle failed */
  error?: NeedleError;
}

export interface NeedleError {
  phase: NeedlePhase;
  code: string;
  message: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Stitch — Completed, observed, verified action (deed)
// ────────────────────────────────────────────────────────────────────────────

export type StitchKind =
  | 'deed'         // Confirmed action with real effect
  | 'silent'       // Recorded but no visible external effect (deny, internal, simulation)
  | 'torn';        // Failed or disputed — still recorded, but not trusted

/**
 * A Stitch is a completed Needle that has been observed and verified.
 * Stitches are the atomic units that form a Thread.
 *
 *   Needle (execution) + Observer (verification) = Stitch
 */
export interface Stitch {
  /** Stitch identifier (same as needle_id that produced it) */
  stitch_id: string;

  /** What kind of stitch */
  kind: StitchKind;

  /** The intent that was executed */
  intent: string;

  /** Actor who performed the action */
  actor_id: string;

  /** TPS coordinate of execution */
  tps_coordinate?: string;

  /** The observation record */
  observation: AxisObservation;

  /** Truth verification result */
  verdict: TruthVerdict;

  /** Loom receipt anchoring this stitch to the thread */
  receipt: LoomReceipt;

  /** Thread this stitch belongs to */
  thread_id: string;

  /** Position in the thread */
  sequence: number;

  /** Timeline event reference (if recorded in timeline) */
  timeline_event_id?: string;

  /** When the stitch was formed */
  stitched_at: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Thread — The continuous witness chain (memory of reality)
// ────────────────────────────────────────────────────────────────────────────

/**
 * A Thread is a continuous, immutable chain of stitches that preserves
 * the history of actions across time. Built from OpenLogs + Witness + TPS.
 *
 * Thread rules:
 *   1. Immutable — past stitches cannot be modified
 *   2. Ordered — by TPS coordinate and sequence number
 *   3. Branchable — can fork into alternate timelines
 *   4. Replayable — can re-execute past stitches
 *   5. Provable — backed by witness records
 */
export interface Thread {
  /** Thread state (from Loom) */
  state: ThreadState;

  /** Total stitch count */
  length: number;

  /** TPS coordinate of first stitch */
  started_at_tps?: string;

  /** TPS coordinate of most recent stitch */
  last_stitch_tps?: string;

  /** Whether this thread has forked branches */
  has_branches: boolean;

  /** Branch IDs if any */
  branch_ids: string[];
}

import type { AxisSensor } from '../sensor/axis-sensor';

// ────────────────────────────────────────────────────────────────────────────
// Needle Pipeline Configuration
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handler function that the Needle pipeline invokes to execute the intent.
 * This is the "action happens" step.
 */
export type NeedleHandler = (
  intent: CompiledIntent,
  context: NeedleHandlerContext,
) => Promise<NeedleHandlerResult>;

export interface NeedleHandlerContext {
  needle_id: string;
  actor_id: string;
  presence_id: string;
  writ: Writ;
  grants: Grant[];
  tps_coordinate?: string;
}

export interface NeedleHandlerResult {
  ok: boolean;
  effect: string;
  data?: Record<string, unknown>;
  status_code?: number;
}

/**
 * Configuration for the Needle pipeline.
 */
export interface NeedlePipelineConfig {
  /** Handler registry: intent name → handler function */
  handlers: Map<string, NeedleHandler>;

  /** Private key for Loom signing (hex string) */
  private_key: string;

  /** Public key for verification (hex string) */
  public_key: string;

  /** Sensors to run as reality gates before handler execution */
  sensors?: AxisSensor[];

  /** Whether to record stitches into the Timeline engine */
  record_timeline?: boolean;

  /** Default TPS coordinate generator (if not provided per-needle) */
  tps_provider?: () => string;
}

/**
 * The result of running a full Needle pipeline.
 */
export interface NeedlePipelineResult {
  /** Whether the full pipeline succeeded */
  ok: boolean;

  /** The completed needle */
  needle: Needle;

  /** The stitch produced (if successful) */
  stitch?: Stitch;

  /** Updated thread state */
  thread_state?: ThreadState;

  /** Timeline event (if timeline recording enabled) */
  timeline_event?: TimelineEvent;
}
