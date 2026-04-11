/**
 * Pattern Engine — Detect, record, and predict from recurring structures
 *
 * Operations:
 *   InMemoryPatternStore  → simple pattern storage
 *   detectSequencePattern() → find recurring intent sequences in stitches
 *   detectKnotPattern()     → find recurring knot formations
 *   matchPatterns()         → check stitches against known patterns
 *   recordOccurrence()     → update a pattern when it's seen again
 */

import { randomBytes } from 'crypto';
import type {
  Pattern,
  PatternKind,
  PatternMatch,
  PatternSignature,
  PatternStore,
} from './pattern.types';
import type { Knot } from './knot.types';
import type { Stitch } from './needle.types';

// ────────────────────────────────────────────────────────────────────────────
// In-Memory Pattern Store
// ────────────────────────────────────────────────────────────────────────────

export class InMemoryPatternStore implements PatternStore {
  private patterns = new Map<string, Pattern>();

  save(pattern: Pattern): void {
    this.patterns.set(pattern.pattern_id, pattern);
  }

  get(patternId: string): Pattern | undefined {
    return this.patterns.get(patternId);
  }

  findByKind(kind: PatternKind): Pattern[] {
    return [...this.patterns.values()].filter((p) => p.kind === kind);
  }

  findByIntent(intent: string): Pattern[] {
    return [...this.patterns.values()].filter(
      (p) => p.signature.intent_sequence?.includes(intent),
    );
  }

  all(): Pattern[] {
    return [...this.patterns.values()];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Sequence Pattern Detection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect recurring intent sequences within a set of stitches.
 * Uses a sliding window to find sequences that appear at least `minOccurrences` times.
 */
export function detectSequencePatterns(
  stitches: Stitch[],
  windowSize: number,
  minOccurrences: number,
): Pattern[] {
  if (stitches.length < windowSize || windowSize < 2) return [];

  const sorted = [...stitches].sort((a, b) => a.sequence - b.sequence);
  const sequenceCounts = new Map<string, { count: number; stitch_ids: string[][] }>();

  // Slide window across stitches
  for (let i = 0; i <= sorted.length - windowSize; i++) {
    const window = sorted.slice(i, i + windowSize);
    const key = window.map((s) => s.intent).join('→');
    const ids = window.map((s) => s.stitch_id);

    const existing = sequenceCounts.get(key);
    if (existing) {
      existing.count++;
      existing.stitch_ids.push(ids);
    } else {
      sequenceCounts.set(key, { count: 1, stitch_ids: [ids] });
    }
  }

  // Filter by minimum occurrences
  const patterns: Pattern[] = [];
  const now = Date.now();

  for (const [key, data] of sequenceCounts) {
    if (data.count < minOccurrences) continue;

    const intents = key.split('→');
    const confidence = Math.min(data.count / (minOccurrences * 2), 1.0);

    patterns.push({
      pattern_id: `pat_seq_${randomBytes(8).toString('hex')}`,
      kind: 'sequence',
      name: `Sequence: ${intents.join(' → ')}`,
      signature: {
        intent_sequence: intents,
        min_length: windowSize,
        max_length: windowSize,
      },
      confidence,
      occurrence_count: data.count,
      first_seen_at: now,
      last_seen_at: now,
      seen_in_threads: [...new Set(
        data.stitch_ids.flatMap((ids) =>
          ids.map((id) => sorted.find((s) => s.stitch_id === id)?.thread_id).filter(Boolean) as string[],
        ),
      )],
      classification: 'unclassified',
    });
  }

  return patterns;
}

// ────────────────────────────────────────────────────────────────────────────
// Knot Pattern Detection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect recurring knot formations (same type + similar size).
 */
export function detectKnotPatterns(
  knots: Knot[],
  minOccurrences: number,
): Pattern[] {
  const groups = new Map<string, Knot[]>();

  for (const knot of knots) {
    if (knot.status !== 'tied') continue;
    const key = `${knot.type}:${knot.stitch_ids.length}`;
    const group = groups.get(key) ?? [];
    group.push(knot);
    groups.set(key, group);
  }

  const patterns: Pattern[] = [];
  const now = Date.now();

  for (const [key, group] of groups) {
    if (group.length < minOccurrences) continue;

    const [type, sizeStr] = key.split(':');
    const size = parseInt(sizeStr, 10);
    const confidence = Math.min(group.length / (minOccurrences * 2), 1.0);

    patterns.push({
      pattern_id: `pat_knot_${randomBytes(8).toString('hex')}`,
      kind: 'knot',
      name: `Knot: ${type} (${size} stitches)`,
      signature: {
        knot_type: type as Pattern['signature']['knot_type'],
        knot_size: size,
      },
      confidence,
      occurrence_count: group.length,
      first_seen_at: now,
      last_seen_at: now,
      seen_in_threads: [...new Set(group.map((k) => k.thread_id))],
      classification: 'unclassified',
    });
  }

  return patterns;
}

// ────────────────────────────────────────────────────────────────────────────
// Pattern Matching
// ────────────────────────────────────────────────────────────────────────────

/**
 * Match a set of stitches against known patterns.
 * Returns all matches with their scores.
 */
export function matchPatterns(
  stitches: Stitch[],
  patterns: Pattern[],
): PatternMatch[] {
  const sorted = [...stitches].sort((a, b) => a.sequence - b.sequence);
  const matches: PatternMatch[] = [];
  const now = Date.now();

  for (const pattern of patterns) {
    if (pattern.kind === 'sequence' && pattern.signature.intent_sequence) {
      const seq = pattern.signature.intent_sequence;
      const seqLen = seq.length;

      // Slide window
      for (let i = 0; i <= sorted.length - seqLen; i++) {
        const window = sorted.slice(i, i + seqLen);
        const windowIntents = window.map((s) => s.intent);

        if (windowIntents.every((intent, idx) => intent === seq[idx])) {
          matches.push({
            pattern_id: pattern.pattern_id,
            matched_stitch_ids: window.map((s) => s.stitch_id),
            match_score: 1.0,
            thread_id: window[0].thread_id,
            detected_at: now,
          });
        }
      }
    }
  }

  return matches;
}

// ────────────────────────────────────────────────────────────────────────────
// Record Occurrence
// ────────────────────────────────────────────────────────────────────────────

/**
 * Record that a pattern was observed again.
 * Updates occurrence count, last_seen_at, confidence, and thread tracking.
 */
export function recordOccurrence(
  pattern: Pattern,
  threadId: string,
): void {
  pattern.occurrence_count++;
  pattern.last_seen_at = Date.now();

  // Confidence grows with occurrences (asymptotic to 1.0)
  pattern.confidence = 1 - 1 / (1 + pattern.occurrence_count * 0.5);

  if (!pattern.seen_in_threads.includes(threadId)) {
    pattern.seen_in_threads.push(threadId);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Anomaly Detection
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if recent stitches deviate from established patterns.
 * Returns anomaly patterns for sequences that should match but don't.
 */
export function detectAnomalies(
  recentStitches: Stitch[],
  knownPatterns: Pattern[],
  threshold: number = 0.7,
): Pattern[] {
  const anomalies: Pattern[] = [];
  const sorted = [...recentStitches].sort((a, b) => a.sequence - b.sequence);
  const now = Date.now();

  for (const pattern of knownPatterns) {
    if (pattern.kind !== 'sequence' || !pattern.signature.intent_sequence) continue;
    if (pattern.confidence < threshold) continue;

    const seq = pattern.signature.intent_sequence;
    // Check if the sequence started but didn't complete
    if (sorted.length >= 1 && sorted.length < seq.length) {
      const partialMatch = sorted.every(
        (s, i) => i < seq.length && s.intent === seq[i],
      );

      if (partialMatch) {
        // Started the pattern but didn't finish — might be anomaly
        const expectedNext = seq[sorted.length];
        const lastStitch = sorted[sorted.length - 1];

        // Only flag if the pattern is well-established
        if (pattern.occurrence_count >= 3) {
          anomalies.push({
            pattern_id: `pat_anom_${randomBytes(8).toString('hex')}`,
            kind: 'anomaly',
            name: `Incomplete: ${pattern.name}`,
            description: `Expected '${expectedNext}' after '${lastStitch.intent}' based on pattern '${pattern.name}'`,
            signature: pattern.signature,
            confidence: pattern.confidence * 0.8,
            occurrence_count: 1,
            first_seen_at: now,
            last_seen_at: now,
            seen_in_threads: [lastStitch.thread_id],
            classification: 'anomalous',
          });
        }
      }
    }
  }

  return anomalies;
}
