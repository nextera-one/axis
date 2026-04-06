import { AxisObservation } from '../axis-observation';
import { ObservationQueueMessage } from './observation-queue.types';

export interface ObservationStreamEntry {
  id: string;
  message: ObservationQueueMessage;
}

export function buildQueueMessage(
  observation: AxisObservation,
  sourceNodeId: string,
  previous?: ObservationQueueMessage,
  lastError?: string,
): ObservationQueueMessage {
  const now = Date.now();

  return {
    v: 1,
    observation,
    attempts: previous ? previous.attempts + 1 : 0,
    firstEnqueuedAt: previous?.firstEnqueuedAt ?? now,
    lastEnqueuedAt: now,
    sourceNodeId,
    lastError,
  };
}

export function encodeQueueMessage(message: ObservationQueueMessage): string {
  return JSON.stringify(message);
}

export function decodeQueueMessage(
  raw: string,
): ObservationQueueMessage | null {
  try {
    const parsed = JSON.parse(raw) as ObservationQueueMessage;
    if (!parsed || parsed.v !== 1 || !parsed.observation?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseStreamEntries(raw: any): ObservationStreamEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: ObservationStreamEntry[] = [];
  for (const streamRow of raw) {
    if (!Array.isArray(streamRow) || streamRow.length < 2) {
      continue;
    }

    const messageRows = streamRow[1];
    if (!Array.isArray(messageRows)) {
      continue;
    }

    for (const row of messageRows) {
      if (!Array.isArray(row) || row.length < 2) {
        continue;
      }

      const id = String(row[0]);
      const fields = Array.isArray(row[1]) ? row[1] : [];
      const fieldMap = fieldsToMap(fields);
      const payload = fieldMap.get('payload');
      if (!payload) {
        continue;
      }

      const message = decodeQueueMessage(payload);
      if (!message) {
        continue;
      }

      entries.push({ id, message });
    }
  }

  return entries;
}

export function parseAutoClaimEntries(raw: any): ObservationStreamEntry[] {
  if (!Array.isArray(raw) || raw.length < 2) {
    return [];
  }

  const rows = Array.isArray(raw[1]) ? raw[1] : [];
  return parseStreamEntries([['stream', rows]]);
}

function fieldsToMap(fields: any[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    if (key !== undefined && value !== undefined) {
      map.set(String(key), String(value));
    }
  }
  return map;
}
