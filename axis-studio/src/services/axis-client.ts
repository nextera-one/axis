/**
 * AXIS Client Service — builds and sends JSON frames to an AXIS node.
 * Runs in the browser, no Node crypto required (uses Web Crypto + noble-ed25519 if signing).
 */

import { useConnectionStore } from 'stores/connection';
import { useAuthStore } from 'stores/auth';
import { useHistoryStore, type HistoryEntry } from 'stores/history';

/* ── helpers ─────────────────────────────────────────────── */

function generateNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function ulid(): string {
  const ts = Date.now().toString(36).padStart(10, '0');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => b.toString(36).padStart(2, '0').slice(-1))
    .join('');
  return (ts + rand).toUpperCase();
}

/* ── types ───────────────────────────────────────────────── */

export interface AxisJsonFrame {
  v: number;
  pid: string;
  nonce: string;
  ts: number;
  actorId: string;
  aud: string;
  opcode: string;
  body: Record<string, unknown>;
}

export interface SendResult {
  ok: boolean;
  status: number;
  durationMs: number;
  response: unknown;
  raw: string;
  effect: string;
}

/* ── main send ───────────────────────────────────────────── */

export async function sendIntent(
  intent: string,
  body: Record<string, unknown> = {},
): Promise<SendResult> {
  const conn = useConnectionStore();
  const auth = useAuthStore();
  const history = useHistoryStore();

  const frame: AxisJsonFrame = {
    v: 1,
    pid: ulid(),
    nonce: generateNonce(),
    ts: Date.now(),
    actorId: auth.actorId || 'studio:anonymous',
    aud: 'axis-core',
    opcode: intent,
    body,
  };

  const start = performance.now();
  let result: SendResult;

  try {
    const res = await fetch(conn.nodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(frame),
      signal: AbortSignal.timeout(30_000),
    });

    const raw = await res.text();
    const durationMs = Math.round(performance.now() - start);
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }

    result = {
      ok: res.ok,
      status: res.status,
      durationMs,
      response: parsed,
      raw,
      effect: parsed?.effect || parsed?.result?.effect || '',
    };
  } catch (e: any) {
    const durationMs = Math.round(performance.now() - start);
    result = {
      ok: false,
      status: 0,
      durationMs,
      response: { error: e.message },
      raw: e.message,
      effect: 'ERROR',
    };
  }

  // record in history
  history.push({
    id: frame.pid,
    ts: frame.ts,
    intent,
    requestBody: JSON.stringify(body, null, 2),
    responseBody:
      typeof result.response === 'string'
        ? result.response
        : JSON.stringify(result.response, null, 2),
    responseEffect: result.effect || (result.ok ? 'OK' : 'ERROR'),
    durationMs: result.durationMs,
    status: result.ok ? 'ok' : 'error',
    nodeUrl: conn.nodeUrl,
  });

  return result;
}

/* ── catalog helpers ─────────────────────────────────────── */

export async function fetchCatalog(): Promise<any[]> {
  const res = await sendIntent('catalog.list', {});
  if (res.ok && typeof res.response === 'object') {
    return (res.response as any)?.intents || [];
  }
  return [];
}

export async function describeIntent(intent: string): Promise<any> {
  const res = await sendIntent('catalog.describe', { intent });
  if (res.ok && typeof res.response === 'object') {
    return (res.response as any)?.definition || null;
  }
  return null;
}

export async function searchCatalog(query: string): Promise<any[]> {
  const res = await sendIntent('catalog.search', { query });
  if (res.ok && typeof res.response === 'object') {
    return (res.response as any)?.intents || [];
  }
  return [];
}
