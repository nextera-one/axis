/**
 * Timeline Engine
 *
 * Implements the three timeline operations:
 * - Replay: reconstruct and re-execute past events deterministically
 * - Fork: branch from a prior state with changed conditions
 * - Simulate: run scenarios in a shadow domain with no real effect
 *
 * Rules enforced:
 * 1. No past overwrite — original timeline is never modified
 * 2. Replay is not rewrite — original witness remains intact
 * 3. Forks are explicit — named branches with lineage
 * 4. Reality and shadow are separated — simulation never escapes
 * 5. Determinism is declared — each handler states its determinism class
 * 6. Witness is immutable — records are never altered
 */

import { createHash, randomBytes } from 'crypto';

import type {
  ForkRequest,
  ForkResult,
  ReplayDifference,
  ReplayRequest,
  ReplayResult,
  SimulatedSideEffect,
  SimulationRequest,
  SimulationResult,
  StateSnapshot,
  TimelineBranch,
  TimelineComparison,
  TimelineDomain,
  TimelineEvent,
  TimelineHandler,
  TimelineHandlerContext,
  TimelineHandlerResult,
} from './timeline.types';
import type { TimelineStore } from './timeline.store';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hashPayload(payload: Record<string, unknown>): string {
  return sha256(JSON.stringify(payload));
}

function diffObjects(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): ReplayDifference[] {
  const diffs: ReplayDifference[] = [];
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diffs.push({ field: key, original: va, replayed: vb });
    }
  }

  return diffs;
}

// ────────────────────────────────────────────────────────────────────────────
// Timeline Engine
// ────────────────────────────────────────────────────────────────────────────

export class TimelineEngine {
  private handlers = new Map<string, TimelineHandler>();

  constructor(private readonly store: TimelineStore) {}

  /** Register an intent handler for timeline execution */
  registerHandler(handler: TimelineHandler): void {
    this.handlers.set(handler.intent, handler);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Record (store a real execution as a timeline event)
  // ──────────────────────────────────────────────────────────────────────

  async recordEvent(
    intent: string,
    actorId: string,
    payload: Record<string, unknown>,
    result: Record<string, unknown>,
    options: {
      timelineId?: string;
      branchId?: string;
      capsuleId?: string;
      tpsCoordinate?: string;
      witnessId?: string;
      determinism?: TimelineEvent['determinism'];
      parentEventId?: string;
    } = {},
  ): Promise<TimelineEvent> {
    const event: TimelineEvent = {
      event_id: generateId('evt'),
      timeline_id: options.timelineId ?? 'prime',
      branch_id: options.branchId ?? 'main',
      parent_event_id: options.parentEventId ?? null,
      intent,
      actor_id: actorId,
      capsule_id: options.capsuleId,
      tps_coordinate: options.tpsCoordinate,
      payload_hash: hashPayload(payload),
      result_hash: hashPayload(result),
      status: 'executed',
      domain: 'prime',
      determinism: options.determinism ?? 'deterministic',
      witness_id: options.witnessId,
      created_at: Date.now(),
      metadata: { payload, result },
    };

    await this.store.saveEvent(event);
    return event;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Replay
  // ──────────────────────────────────────────────────────────────────────

  async replay(request: ReplayRequest): Promise<ReplayResult> {
    const originalEvent = await this.store.getEvent(request.source_event_id);
    if (!originalEvent) {
      throw new Error(`Event ${request.source_event_id} not found`);
    }

    const handler = this.handlers.get(originalEvent.intent);
    if (!handler) {
      throw new Error(`No handler registered for intent '${originalEvent.intent}'`);
    }

    // Get original payload from metadata
    const originalPayload =
      (originalEvent.metadata?.payload as Record<string, unknown>) ?? {};
    const replayPayload =
      request.mode === 'analytical' && request.override_payload
        ? request.override_payload
        : originalPayload;

    // Load snapshot if available
    const snapshot = await this.store.getSnapshotByEvent(originalEvent.event_id);

    const context: TimelineHandlerContext = {
      event_id: generateId('evt'),
      timeline_id: originalEvent.timeline_id,
      branch_id: `replay_${originalEvent.branch_id}`,
      domain: 'audit',
      actor_id: originalEvent.actor_id,
      tps_coordinate: originalEvent.tps_coordinate,
      snapshot: snapshot ?? undefined,
      is_replay: true,
      is_simulation: false,
    };

    const startMs = Date.now();
    const handlerResult = await handler.execute(replayPayload, context);
    const durationMs = Date.now() - startMs;

    const replayedEvent: TimelineEvent = {
      event_id: context.event_id,
      timeline_id: originalEvent.timeline_id,
      branch_id: context.branch_id,
      parent_event_id: originalEvent.event_id,
      intent: originalEvent.intent,
      actor_id: originalEvent.actor_id,
      capsule_id: originalEvent.capsule_id,
      tps_coordinate: originalEvent.tps_coordinate,
      payload_hash: hashPayload(replayPayload),
      result_hash: hashPayload(handlerResult.result_data),
      status: 'replayed',
      domain: 'audit',
      determinism: originalEvent.determinism,
      created_at: Date.now(),
      metadata: { payload: replayPayload, result: handlerResult.result_data },
    };

    await this.store.saveEvent(replayedEvent);

    // Compare results
    const originalResult =
      (originalEvent.metadata?.result as Record<string, unknown>) ?? {};
    const differences = diffObjects(originalResult, handlerResult.result_data);
    const deterministicMatch =
      originalEvent.result_hash === replayedEvent.result_hash;

    return {
      original_event: originalEvent,
      replayed_event: replayedEvent,
      mode: request.mode,
      deterministic_match: deterministicMatch,
      differences,
      duration_ms: durationMs,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Fork
  // ──────────────────────────────────────────────────────────────────────

  async fork(request: ForkRequest): Promise<ForkResult> {
    const sourceEvent = await this.store.getEvent(request.source_event_id);
    if (!sourceEvent) {
      throw new Error(`Event ${request.source_event_id} not found`);
    }

    const handler = this.handlers.get(sourceEvent.intent);
    if (!handler) {
      throw new Error(`No handler registered for intent '${sourceEvent.intent}'`);
    }

    // Create branch
    const branch: TimelineBranch = {
      branch_id: generateId('branch'),
      timeline_id: generateId('timeline'),
      origin_timeline_id: sourceEvent.timeline_id,
      origin_event_id: sourceEvent.event_id,
      branch_type: 'fork',
      creator_subject_id: request.actor_id,
      purpose: request.purpose,
      status: 'active',
    };

    await this.store.saveBranch(branch);

    // Take snapshot of source state
    const snapshot: StateSnapshot = {
      snapshot_id: generateId('snap'),
      timeline_id: sourceEvent.timeline_id,
      event_id: sourceEvent.event_id,
      tps_coordinate: sourceEvent.tps_coordinate,
      state_hash: hashPayload(
        (sourceEvent.metadata?.result as Record<string, unknown>) ?? {},
      ),
      state_data:
        (sourceEvent.metadata?.result as Record<string, unknown>) ?? {},
      created_at: Date.now(),
    };

    await this.store.saveSnapshot(snapshot);

    // Execute with new payload
    const context: TimelineHandlerContext = {
      event_id: generateId('evt'),
      timeline_id: branch.timeline_id,
      branch_id: branch.branch_id,
      domain: 'fork',
      actor_id: request.actor_id,
      tps_coordinate: sourceEvent.tps_coordinate,
      snapshot,
      is_replay: false,
      is_simulation: false,
    };

    const handlerResult = await handler.execute(request.new_payload, context);

    const forkedEvent: TimelineEvent = {
      event_id: context.event_id,
      timeline_id: branch.timeline_id,
      branch_id: branch.branch_id,
      parent_event_id: sourceEvent.event_id,
      intent: sourceEvent.intent,
      actor_id: request.actor_id,
      tps_coordinate: sourceEvent.tps_coordinate,
      payload_hash: hashPayload(request.new_payload),
      result_hash: hashPayload(handlerResult.result_data),
      status: 'forked',
      domain: 'fork',
      determinism: sourceEvent.determinism,
      created_at: Date.now(),
      metadata: {
        payload: request.new_payload,
        result: handlerResult.result_data,
      },
    };

    await this.store.saveEvent(forkedEvent);

    return { branch, forked_event: forkedEvent, snapshot };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Simulate
  // ──────────────────────────────────────────────────────────────────────

  async simulate(request: SimulationRequest): Promise<SimulationResult> {
    const handler = this.handlers.get(request.intent);
    if (!handler) {
      throw new Error(`No handler registered for intent '${request.intent}'`);
    }

    // Load source snapshot if specified
    let snapshot: StateSnapshot | undefined;
    if (request.from_snapshot_id) {
      const loaded = await this.store.getSnapshot(request.from_snapshot_id);
      if (!loaded) {
        throw new Error(`Snapshot ${request.from_snapshot_id} not found`);
      }
      snapshot = loaded;
    }

    // Create shadow branch
    const branch: TimelineBranch = {
      branch_id: generateId('branch'),
      timeline_id: generateId('timeline'),
      origin_timeline_id: 'prime',
      origin_event_id: 'simulation_origin',
      branch_type: 'simulation',
      created_at_tps: request.at_tps,
      creator_subject_id: request.actor_id,
      purpose: request.purpose,
      status: 'active',
    };

    await this.store.saveBranch(branch);

    const context: TimelineHandlerContext = {
      event_id: generateId('evt'),
      timeline_id: branch.timeline_id,
      branch_id: branch.branch_id,
      domain: 'shadow',
      actor_id: request.actor_id,
      tps_coordinate: request.at_tps,
      snapshot,
      is_replay: false,
      is_simulation: true,
    };

    const startMs = Date.now();
    const handlerResult = await handler.execute(request.payload, context);
    const durationMs = Date.now() - startMs;

    const simulatedEvent: TimelineEvent = {
      event_id: context.event_id,
      timeline_id: branch.timeline_id,
      branch_id: branch.branch_id,
      parent_event_id: null,
      intent: request.intent,
      actor_id: request.actor_id,
      tps_coordinate: request.at_tps,
      payload_hash: hashPayload(request.payload),
      result_hash: hashPayload(handlerResult.result_data),
      status: 'simulated',
      domain: 'shadow',
      determinism: 'bounded_nondeterministic',
      created_at: Date.now(),
      metadata: { payload: request.payload, result: handlerResult.result_data },
    };

    await this.store.saveEvent(simulatedEvent);

    // Mark branch as completed
    branch.status = 'completed';
    await this.store.saveBranch(branch);

    return {
      branch,
      simulated_event: simulatedEvent,
      predicted_outcome: handlerResult.result_data,
      side_effects: handlerResult.side_effects ?? [],
      duration_ms: durationMs,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Compare timelines
  // ──────────────────────────────────────────────────────────────────────

  async compare(
    timelineIdA: string,
    timelineIdB: string,
  ): Promise<TimelineComparison> {
    const eventsA = await this.store.getEventsByTimeline(timelineIdA);
    const eventsB = await this.store.getEventsByTimeline(timelineIdB);

    // Sort by creation time
    eventsA.sort((a, b) => a.created_at - b.created_at);
    eventsB.sort((a, b) => a.created_at - b.created_at);

    const maxLen = Math.max(eventsA.length, eventsB.length);
    const eventPairs: TimelineComparison['event_pairs'] = [];
    let divergencePoint: string | undefined;

    for (let i = 0; i < maxLen; i++) {
      const a = eventsA[i];
      const b = eventsB[i];

      if (!a || !b) {
        if (!divergencePoint) {
          divergencePoint = a?.event_id ?? b?.event_id;
        }
        continue;
      }

      const match = a.result_hash === b.result_hash;
      const resultA =
        (a.metadata?.result as Record<string, unknown>) ?? {};
      const resultB =
        (b.metadata?.result as Record<string, unknown>) ?? {};
      const differences = match ? [] : diffObjects(resultA, resultB);

      if (!match && !divergencePoint) {
        divergencePoint = a.event_id;
      }

      eventPairs.push({ event_a: a, event_b: b, match, differences });
    }

    return {
      timeline_a: timelineIdA,
      timeline_b: timelineIdB,
      event_pairs: eventPairs,
      divergence_point: divergencePoint,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // State snapshot management
  // ──────────────────────────────────────────────────────────────────────

  async createSnapshot(
    eventId: string,
    stateData: Record<string, unknown>,
  ): Promise<StateSnapshot> {
    const event = await this.store.getEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    const snapshot: StateSnapshot = {
      snapshot_id: generateId('snap'),
      timeline_id: event.timeline_id,
      event_id: eventId,
      tps_coordinate: event.tps_coordinate,
      state_hash: hashPayload(stateData),
      state_data: stateData,
      created_at: Date.now(),
    };

    await this.store.saveSnapshot(snapshot);
    return snapshot;
  }

  async restoreSnapshot(snapshotId: string): Promise<StateSnapshot> {
    const snapshot = await this.store.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    return snapshot;
  }
}
