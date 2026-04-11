/**
 * Pattern — Recurring structure in the Fabric
 *
 * A Pattern is a recognized shape of stitches, knots, or state changes
 * that repeats across threads or timelines. Patterns are the learning
 * layer — they answer: "I've seen this shape before."
 *
 * Hierarchy:
 *   Stitches form Threads
 *   Important stitches form Knots
 *   Knots define Reality Structure
 *   Recurring structures form Patterns
 *   Patterns reveal the nature of the Fabric
 *
 * Pattern detection enables AXIS Being to:
 *   - Predict outcomes before execution
 *   - Suggest alternatives based on history
 *   - Identify anomalies (deviation from known patterns)
 *   - Learn from past executions
 */

import type { Knot, KnotType } from './knot.types';
import type { Stitch, StitchKind } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// Pattern Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * Sequence:   Ordered chain of intents that recur (A → B → C)
 * Knot:       Recurring knot formation (same knot type + shape)
 * State:      Recurring state mutation pattern in the Fabric
 * Decision:   Recurring decision path at fork points
 * Anomaly:    Deviation from an established pattern
 */
export type PatternKind =
  | 'sequence'
  | 'knot'
  | 'state'
  | 'decision'
  | 'anomaly';

export type PatternConfidence = number; // 0.0 – 1.0

// ────────────────────────────────────────────────────────────────────────────
// Pattern Definition
// ────────────────────────────────────────────────────────────────────────────

/**
 * A Pattern is a recognized recurring structure in the Fabric.
 */
export interface Pattern {
  /** Unique pattern identifier */
  pattern_id: string;

  /** What kind of pattern */
  kind: PatternKind;

  /** Human-readable name */
  name: string;

  /** Description of what this pattern represents */
  description?: string;

  /** The signature that defines this pattern (what to look for) */
  signature: PatternSignature;

  /** How confident the system is that this is a real pattern */
  confidence: PatternConfidence;

  /** How many times this pattern has been observed */
  occurrence_count: number;

  /** When this pattern was first detected */
  first_seen_at: number;

  /** When this pattern was last matched */
  last_seen_at: number;

  /** Thread IDs where this pattern has appeared */
  seen_in_threads: string[];

  /** Whether this pattern is considered normal or anomalous */
  classification: 'normal' | 'anomalous' | 'unclassified';

  /** What typically follows this pattern (predicted next step) */
  predicted_next?: PatternPrediction;
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Signature — What defines a pattern
// ────────────────────────────────────────────────────────────────────────────

export interface PatternSignature {
  /** Ordered list of intent names (for sequence patterns) */
  intent_sequence?: string[];

  /** Stitch kinds in order (for stitch-level patterns) */
  stitch_kinds?: StitchKind[];

  /** Knot type (for knot patterns) */
  knot_type?: KnotType;

  /** Number of stitches in the knot (for knot patterns) */
  knot_size?: number;

  /** State key prefixes affected (for state patterns) */
  state_keys?: string[];

  /** State mutation shape: key → 'created' | 'updated' | 'deleted' */
  state_mutations?: Record<string, 'created' | 'updated' | 'deleted'>;

  /** Decision outcome that recurs (for decision patterns) */
  decision_outcome?: string;

  /** Actor pattern: specific actor or '*' for any */
  actor?: string;

  /** Minimum stitches in the sequence */
  min_length?: number;

  /** Maximum stitches in the sequence */
  max_length?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Match
// ────────────────────────────────────────────────────────────────────────────

/** A match of a pattern against actual stitches. */
export interface PatternMatch {
  /** Pattern that was matched */
  pattern_id: string;

  /** Stitch IDs that form this match */
  matched_stitch_ids: string[];

  /** Knot IDs involved (if knot pattern) */
  matched_knot_ids?: string[];

  /** How well the match fits (0.0 – 1.0) */
  match_score: number;

  /** Thread where the match was found */
  thread_id: string;

  /** When the match was detected */
  detected_at: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Prediction
// ────────────────────────────────────────────────────────────────────────────

/**
 * What the system predicts will happen next based on a pattern.
 * Used by AXIS Being for pre-execution intelligence.
 */
export interface PatternPrediction {
  /** Most likely next intent */
  next_intent: string;

  /** Confidence that this prediction is correct */
  confidence: PatternConfidence;

  /** Alternative possible next intents */
  alternatives: Array<{
    intent: string;
    confidence: PatternConfidence;
  }>;

  /** Predicted outcome if the pattern completes */
  predicted_outcome?: string;

  /** Risk level if the pattern continues */
  risk_note?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Registry
// ────────────────────────────────────────────────────────────────────────────

/**
 * Store interface for patterns.
 * Implementations can use in-memory, database, or ML model.
 */
export interface PatternStore {
  save(pattern: Pattern): void;
  get(patternId: string): Pattern | undefined;
  findByKind(kind: PatternKind): Pattern[];
  findByIntent(intent: string): Pattern[];
  all(): Pattern[];
}
