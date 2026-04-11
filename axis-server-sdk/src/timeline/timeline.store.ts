/**
 * Timeline Store Interface
 *
 * Pluggable storage interface for timeline events, branches, and snapshots.
 * Implementations can use in-memory, database, or any persistence layer.
 */

import type {
  TimelineEvent,
  TimelineBranch,
  StateSnapshot,
} from './timeline.types';

export interface TimelineStore {
  // Events
  saveEvent(event: TimelineEvent): Promise<void>;
  getEvent(eventId: string): Promise<TimelineEvent | null>;
  getEventsByTimeline(timelineId: string): Promise<TimelineEvent[]>;
  getEventsByBranch(branchId: string): Promise<TimelineEvent[]>;

  // Branches
  saveBranch(branch: TimelineBranch): Promise<void>;
  getBranch(branchId: string): Promise<TimelineBranch | null>;
  getBranchesByTimeline(timelineId: string): Promise<TimelineBranch[]>;

  // Snapshots
  saveSnapshot(snapshot: StateSnapshot): Promise<void>;
  getSnapshot(snapshotId: string): Promise<StateSnapshot | null>;
  getSnapshotByEvent(eventId: string): Promise<StateSnapshot | null>;
}

/**
 * In-memory timeline store for development and testing.
 */
export class InMemoryTimelineStore implements TimelineStore {
  private events = new Map<string, TimelineEvent>();
  private branches = new Map<string, TimelineBranch>();
  private snapshots = new Map<string, StateSnapshot>();

  async saveEvent(event: TimelineEvent): Promise<void> {
    this.events.set(event.event_id, event);
  }

  async getEvent(eventId: string): Promise<TimelineEvent | null> {
    return this.events.get(eventId) ?? null;
  }

  async getEventsByTimeline(timelineId: string): Promise<TimelineEvent[]> {
    return [...this.events.values()].filter((e) => e.timeline_id === timelineId);
  }

  async getEventsByBranch(branchId: string): Promise<TimelineEvent[]> {
    return [...this.events.values()].filter((e) => e.branch_id === branchId);
  }

  async saveBranch(branch: TimelineBranch): Promise<void> {
    this.branches.set(branch.branch_id, branch);
  }

  async getBranch(branchId: string): Promise<TimelineBranch | null> {
    return this.branches.get(branchId) ?? null;
  }

  async getBranchesByTimeline(timelineId: string): Promise<TimelineBranch[]> {
    return [...this.branches.values()].filter((b) => b.timeline_id === timelineId);
  }

  async saveSnapshot(snapshot: StateSnapshot): Promise<void> {
    this.snapshots.set(snapshot.snapshot_id, snapshot);
  }

  async getSnapshot(snapshotId: string): Promise<StateSnapshot | null> {
    return this.snapshots.get(snapshotId) ?? null;
  }

  async getSnapshotByEvent(eventId: string): Promise<StateSnapshot | null> {
    return (
      [...this.snapshots.values()].find((s) => s.event_id === eventId) ?? null
    );
  }
}
