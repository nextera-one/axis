/**
 * Fabric Engine — State projection from stitches
 *
 * Weaves stitches into a unified state (Fabric).
 *
 * Operations:
 *   createFabric()     → empty fabric
 *   applyStitch()      → apply one stitch's effect to the fabric
 *   weave()            → project fabric from a sequence of stitches
 *   projectAt()        → compute fabric state at a specific TPS coordinate
 *   queryFabric()      → search fabric cells
 *   diffFabrics()      → compare two fabric states
 *   lockCells()        → mark cells as locked by an irreversible knot
 */

import { createHash, randomBytes } from 'crypto';
import type {
  Fabric,
  FabricCell,
  FabricDiff,
  FabricDiffEntry,
  FabricEffect,
  FabricEffectResolver,
  FabricQuery,
} from './fabric.types';
import type { Knot } from './knot.types';
import type { Stitch } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// Create
// ────────────────────────────────────────────────────────────────────────────

/** Create an empty Fabric. */
export function createFabric(): Fabric {
  return {
    fabric_id: `fab_${randomBytes(16).toString('hex')}`,
    state_hash: hashState(new Map()),
    cells: new Map(),
    thread_ids: [],
    stitch_count: 0,
    knot_count: 0,
    computed_at: Date.now(),
    version: 0,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Apply single stitch
// ────────────────────────────────────────────────────────────────────────────

/**
 * Apply a single stitch's effect to the fabric.
 * Mutates the fabric in place and increments version.
 */
export function applyStitch(
  fabric: Fabric,
  stitch: Stitch,
  effect: FabricEffect,
): void {
  // Apply mutations
  for (const [key, value] of Object.entries(effect.mutations)) {
    if (value === null) {
      // Delete
      fabric.cells.delete(key);
    } else {
      const existing = fabric.cells.get(key);

      // Cannot write to locked cells
      if (existing?.locked) {
        continue;
      }

      fabric.cells.set(key, {
        key,
        value,
        last_stitch_id: stitch.stitch_id,
        last_tps: stitch.tps_coordinate,
        write_count: (existing?.write_count ?? 0) + 1,
        locked: false,
      });
    }
  }

  // Track thread
  if (!fabric.thread_ids.includes(stitch.thread_id)) {
    fabric.thread_ids.push(stitch.thread_id);
  }

  fabric.stitch_count++;
  fabric.version++;
  fabric.projected_at_tps = stitch.tps_coordinate ?? fabric.projected_at_tps;
  fabric.computed_at = Date.now();
  fabric.state_hash = hashState(fabric.cells);
}

// ────────────────────────────────────────────────────────────────────────────
// Weave (batch projection)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Weave a sequence of stitches into a fabric.
 * Stitches must be in chronological order (by sequence).
 * The resolver extracts the FabricEffect from each stitch.
 */
export function weave(
  stitches: Stitch[],
  resolver: FabricEffectResolver,
  knots?: Knot[],
): Fabric {
  const fabric = createFabric();

  // Sort by sequence to ensure deterministic ordering
  const sorted = [...stitches].sort((a, b) => a.sequence - b.sequence);

  for (const stitch of sorted) {
    // Skip torn stitches — they don't affect reality
    if (stitch.kind === 'torn') continue;

    const effect = resolver(stitch);
    applyStitch(fabric, stitch, effect);
  }

  // Apply knot locks
  if (knots) {
    for (const knot of knots) {
      if (knot.irreversible && knot.status === 'tied') {
        lockCellsByKnot(fabric, knot, stitches, resolver);
        fabric.knot_count++;
      }
    }
  }

  return fabric;
}

/**
 * Project fabric state at a specific TPS coordinate.
 * Only applies stitches up to (and including) the given TPS.
 */
export function projectAt(
  stitches: Stitch[],
  resolver: FabricEffectResolver,
  tpsFilter: (tps: string | undefined) => boolean,
  knots?: Knot[],
): Fabric {
  const filtered = stitches.filter((s) => tpsFilter(s.tps_coordinate));
  return weave(filtered, resolver, knots);
}

// ────────────────────────────────────────────────────────────────────────────
// Lock cells (irreversible knots)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Lock all cells touched by stitches in an irreversible knot.
 * Locked cells cannot be overwritten by future stitches.
 */
function lockCellsByKnot(
  fabric: Fabric,
  knot: Knot,
  stitches: Stitch[],
  resolver: FabricEffectResolver,
): void {
  const knotStitchIds = new Set(knot.stitch_ids);
  const knotStitches = stitches.filter((s) => knotStitchIds.has(s.stitch_id));

  for (const stitch of knotStitches) {
    const effect = resolver(stitch);
    for (const key of Object.keys(effect.mutations)) {
      const cell = fabric.cells.get(key);
      if (cell) {
        cell.locked = true;
        cell.locked_by_knot = knot.knot_id;
      }
    }
  }
}

/** Manually lock specific cells by an irreversible knot. */
export function lockCells(
  fabric: Fabric,
  keys: string[],
  knotId: string,
): void {
  for (const key of keys) {
    const cell = fabric.cells.get(key);
    if (cell) {
      cell.locked = true;
      cell.locked_by_knot = knotId;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Query
// ────────────────────────────────────────────────────────────────────────────

/** Query the fabric for cells matching criteria. */
export function queryFabric(
  fabric: Fabric,
  query: FabricQuery,
): FabricCell[] {
  let results = [...fabric.cells.values()];

  if (query.keys) {
    const keySet = new Set(query.keys);
    results = results.filter((c) => keySet.has(c.key));
  }

  if (query.prefix) {
    const prefix = query.prefix;
    results = results.filter((c) => c.key.startsWith(prefix));
  }

  if (query.locked_only) {
    results = results.filter((c) => c.locked);
  }

  return results;
}

/** Get a single cell value. */
export function getFabricValue(
  fabric: Fabric,
  key: string,
): unknown | undefined {
  return fabric.cells.get(key)?.value;
}

// ────────────────────────────────────────────────────────────────────────────
// Diff
// ────────────────────────────────────────────────────────────────────────────

/** Compute the diff between two fabric states. */
export function diffFabrics(a: Fabric, b: Fabric): FabricDiff {
  const entries: FabricDiffEntry[] = [];
  let added = 0;
  let modified = 0;
  let deleted = 0;

  // Check all keys in B
  for (const [key, cellB] of b.cells) {
    const cellA = a.cells.get(key);
    if (!cellA) {
      entries.push({
        key,
        kind: 'added',
        after: cellB.value,
        caused_by_stitch: cellB.last_stitch_id,
      });
      added++;
    } else if (JSON.stringify(cellA.value) !== JSON.stringify(cellB.value)) {
      entries.push({
        key,
        kind: 'modified',
        before: cellA.value,
        after: cellB.value,
        caused_by_stitch: cellB.last_stitch_id,
      });
      modified++;
    }
  }

  // Check keys in A but not in B (deleted)
  for (const [key, cellA] of a.cells) {
    if (!b.cells.has(key)) {
      entries.push({
        key,
        kind: 'deleted',
        before: cellA.value,
      });
      deleted++;
    }
  }

  return {
    from_fabric_id: a.fabric_id,
    to_fabric_id: b.fabric_id,
    entries,
    added_count: added,
    modified_count: modified,
    deleted_count: deleted,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Hash
// ────────────────────────────────────────────────────────────────────────────

function hashState(cells: Map<string, FabricCell>): string {
  const keys = [...cells.keys()].sort();
  const payload = keys
    .map((k) => `${k}=${JSON.stringify(cells.get(k)!.value)}`)
    .join('\n');
  return createHash('sha256').update(payload).digest('hex');
}
