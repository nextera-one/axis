/**
 * AXIS Client Service — builds and sends binary frames (AXIS1) to an AXIS node.
 * Compatible with nestflow-axis-backend security middleware.
 */

import { useConnectionStore } from 'stores/connection';
import { useAuthStore } from 'stores/auth';
import { useHistoryStore } from 'stores/history';
import {
  AxisFrameBuilder,
  generatePid,
  generateNonce,
  uuidToBytes,
  ProofType,
  decodeVarint,
  decodeTLVs,
  TLVType
} from '@nextera.one/axis-client-sdk/browser';
import * as ed from '@noble/ed25519';

/* ── types ───────────────────────────────────────────────── */

export interface SendResult {
  ok: boolean;
  status: number;
  durationMs: number;
  response: any;
  raw: string;
  effect: string;
}

/* ── helpers ─────────────────────────────────────────────── */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Partial decode of AXIS1 frame response
 * We only care about the body for now
 */
function decodeAxisResponse(buffer: Uint8Array): { body: any, flags: number } {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  
  // Check Magic "AXIS1"
  const magic = new TextDecoder().decode(buffer.slice(0, 5));
  if (magic !== 'AXIS1') throw new Error('Invalid protocol magic');

  let offset = 6; // Version(1) + Flags(1)
  const flags = buffer[5];

  // Decode lengths (Varints)
  const [hdrLen, hdrLenSize] = decodeVarint(buffer.slice(offset));
  offset += hdrLenSize;
  const [bodyLen, bodyLenSize] = decodeVarint(buffer.slice(offset));
  offset += bodyLenSize;
  const [sigLen, sigLenSize] = decodeVarint(buffer.slice(offset));
  offset += sigLenSize;

  // Skip headers
  offset += hdrLen;

  // Body
  const bodyBytes = buffer.slice(offset, offset + bodyLen);
  
  let body: any = null;
  if (bodyBytes.length > 0) {
    try {
      body = JSON.parse(new TextDecoder().decode(bodyBytes));
    } catch {
      body = bodyBytes;
    }
  }

  return { body, flags };
}

/* ── main send ───────────────────────────────────────────── */

export async function sendIntent(
  intent: string,
  body: Record<string, unknown> = {},
): Promise<SendResult> {
  const conn = useConnectionStore();
  const auth = useAuthStore();
  const history = useHistoryStore();

  const pid = generatePid();
  const nonce = generateNonce(32);
  const actorId = auth.actorId ? uuidToBytes(auth.actorId) : new Uint8Array(16);
  const capsuleId = auth.capsuleId ? uuidToBytes(auth.capsuleId) : new Uint8Array(16);

  const builder = new AxisFrameBuilder()
    .setPid(pid)
    .setTimestamp(BigInt(Date.now()))
    .setIntent(intent)
    .setActorId(actorId)
    .setProofType(ProofType.CAPSULE)
    .setProofRef(capsuleId)
    .setNonce(nonce)
    .setBody(new TextEncoder().encode(JSON.stringify(body)));

  // Sign if we have an active key
  const activeKey = auth.getActiveKey();
  let frameBytes: Uint8Array;

  if (activeKey?.privateKeyHex) {
    const privKey = new Uint8Array(
      activeKey.privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const unsigned = builder.buildUnsigned();
    const sig = await ed.signAsync(unsigned, privKey);
    frameBytes = builder.buildSigned(sig);
  } else {
    frameBytes = builder.buildUnsigned();
  }

  const start = performance.now();
  let result: SendResult;

  try {
    const res = await fetch(conn.nodeUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/axis-bin',
        'Accept': 'application/axis-bin'
      },
      body: frameBytes as any,
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Math.round(performance.now() - start);
    
    if (res.ok) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      const { body: respBody } = decodeAxisResponse(buffer);
      
      result = {
        ok: true,
        status: res.status,
        durationMs,
        response: respBody,
        raw: '[BINARY AXIS FRAME]',
        effect: respBody?.effect || respBody?.result?.effect || 'OK',
      };
    } else {
      const text = await res.text();
      result = {
        ok: false,
        status: res.status,
        durationMs,
        response: { error: text },
        raw: text,
        effect: 'ERROR',
      };
    }
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
    id: bytesToHex(pid),
    ts: Date.now(),
    intent,
    requestBody: JSON.stringify(body, null, 2),
    responseBody: JSON.stringify(result.response, null, 2),
    responseEffect: result.effect,
    durationMs: result.durationMs,
    status: result.ok ? 'ok' : 'error',
    nodeUrl: conn.nodeUrl,
  });

  return result;
}

/* ── catalog helpers ─────────────────────────────────────── */

export async function fetchCatalog(): Promise<any[]> {
  const res = await sendIntent('catalog.list', {});
  return res.ok ? (res.response?.intents || []) : [];
}

export async function describeIntent(intent: string): Promise<any> {
  const res = await sendIntent('catalog.describe', { intent });
  return res.ok ? (res.response?.definition || null) : null;
}

export async function searchCatalog(query: string): Promise<any[]> {
  const res = await sendIntent('catalog.search', { query });
  return res.ok ? (res.response?.intents || []) : [];
}
