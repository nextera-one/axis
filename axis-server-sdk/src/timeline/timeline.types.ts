/**
 * Timeline Engine Types
 *
 * Core type definitions for the AXIS Timeline system:
 * - Replay: re-execute past events under deterministic rules
 * - Fork: create branch from prior state with changed conditions
 * - Simulate: run events in shadow domain with no real effect
 */

// ────────────────────────────────────────────────────────────────────────────
// Timeline Domain
// ────────────────────────────────────────────────────────────────────────────

export type TimelineDomain =
  | 'prime'     // Main authoritative timeline
  | 'fork'      // Branch derived from earlier coordinate
  | 'shadow'    // Simulation with no real effect
  | 'training'  // Learning and rehearsal
  | 'audit';    // Replay-focused for diagnostics

export type TimelineEventStatus =
  | 'executed'
  | 'replayed'
  | 'forked'
  | 'simulated'
  | 'failed';

// ────────────────────────────────────────────────────────────────────────────
// Timeline Event
// ────────────────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  event_id: string;
  timeline_id: string;
  branch_id: string;
  parent_event_id: string | null;
  intent: string;
  actor_id: string;
  capsule_id?: string;
  tps_coordinate?: string;
  payload_hash: string;
  result_hash?: string;
  status: TimelineEventStatus;
  domain: TimelineDomain;
  /** Determinism classification */
  determinism: 'deterministic' | 'bounded_nondeterministic' | 'open_nondeterministic';
  /** Witness reference */
  witness_id?: string;
  created_at: number;
  metadata?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────────────────────
// Timeline Branch
// ────────────────────────────────────────────────────────────────────────────

export interface TimelineBranch {
  branch_id: string;
  timeline_id: string;
  origin_timeline_id: string;
  origin_event_id: string;
  branch_type: 'fork' | 'simulation' | 'replay' | 'training';
  created_at_tps?: string;
  creator_subject_id: string;
  purpose: string;
  status: 'active' | 'completed' | 'abandoned';
}

// ────────────────────────────────────────────────────────────────────────────
// State Snapshot
// ────────────────────────────────────────────────────────────────────────────

export interface StateSnapshot {
  snapshot_id: string;
  timeline_id: string;
  event_id: string;
  tps_coordinate?: string;
  state_hash: string;
  state_data: Record<string, unknown>;
  created_at: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Replay
// ────────────────────────────────────────────────────────────────────────────

export type ReplayMode = 'strict' | 'analytical';

export interface ReplayRequest {
  /** Event to replay */
  source_event_id: string;
  /** Mode: strict = expect same output; analytical = compare */
  mode: ReplayMode;
  /** Optional override payload for analytical mode */
  override_payload?: Record<string, unknown>;
}

export interface ReplayResult {
  original_event: TimelineEvent;
  replayed_event: TimelineEvent;
  mode: ReplayMode;
  /** Whether the replay produced the same result */
  deterministic_match: boolean;
  /** Differences between original and replayed result */
  differences: ReplayDifference[];
  duration_ms: number;
}

export interface ReplayDifference {
  field: string;
  original: unknown;
  replayed: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Fork
// ────────────────────────────────────────────────────────────────────────────

export interface ForkRequest {
  /** Event to fork from */
  source_event_id: string;
  /** New payload to use in the forked branch */
  new_payload: Record<string, unknown>;
  /** Purpose description */
  purpose: string;
  /** Actor creating the fork */
  actor_id: string;
}

export interface ForkResult {
  branch: TimelineBranch;
  forked_event: TimelineEvent;
  snapshot?: StateSnapshot;
}

// ────────────────────────────────────────────────────────────────────────────
// Simulation
// ────────────────────────────────────────────────────────────────────────────

export interface SimulationRequest {
  /** Intent to simulate */
  intent: string;
  /** Simulated payload */
  payload: Record<string, unknown>;
  /** Actor identity for simulation context */
  actor_id: string;
  /** Optional TPS coordinate for temporal context */
  at_tps?: string;
  /** Optional state snapshot to start from */
  from_snapshot_id?: string;
  /** Purpose description */
  purpose: string;
}

export interface SimulationResult {
  branch: TimelineBranch;
  simulated_event: TimelineEvent;
  predicted_outcome: Record<string, unknown>;
  side_effects: SimulatedSideEffect[];
  duration_ms: number;
}

export interface SimulatedSideEffect {
  type: string;
  target: string;
  action: string;
  predicted_result: unknown;
}

// ────────────────────────────────────────────────────────────────────────────
// Comparison
// ────────────────────────────────────────────────────────────────────────────

export interface TimelineComparison {
  timeline_a: string;
  timeline_b: string;
  event_pairs: Array<{
    event_a: TimelineEvent;
    event_b: TimelineEvent;
    match: boolean;
    differences: ReplayDifference[];
  }>;
  divergence_point?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Handler interface
// ────────────────────────────────────────────────────────────────────────────

export interface TimelineHandler {
  intent: string;
  execute(payload: Record<string, unknown>, context: TimelineHandlerContext): Promise<TimelineHandlerResult>;
}

export interface TimelineHandlerContext {
  event_id: string;
  timeline_id: string;
  branch_id: string;
  domain: TimelineDomain;
  actor_id: string;
  tps_coordinate?: string;
  snapshot?: StateSnapshot;
  is_replay: boolean;
  is_simulation: boolean;
}

export interface TimelineHandlerResult {
  ok: boolean;
  effect: string;
  result_data: Record<string, unknown>;
  side_effects?: SimulatedSideEffect[];
}
