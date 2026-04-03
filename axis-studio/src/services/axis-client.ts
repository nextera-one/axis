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

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '');
  if (!clean || clean.length % 2 !== 0) {
    throw new Error('Invalid hex key');
  }
  const bytes = new Uint8Array(
    clean.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)),
  );

  // Preferred format: 32-byte Ed25519 secret key.
  // Backward-compat: older studio versions stored PKCS#8 blobs.
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return bytes.slice(-32);
  throw new Error('Unsupported private key length');
}

function safeUuidToBytes(input: string | null | undefined): Uint8Array {
  if (!input) return new Uint8Array(16);
  try {
    return uuidToBytes(input);
  } catch {
    return new Uint8Array(16);
  }
}

function encodeIntentBody(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body === null || body === undefined) return new Uint8Array();
  return new TextEncoder().encode(JSON.stringify(body));
}

/**
 * Partial decode of AXIS1 frame response
 * We only care about the body for now
 */
function decodeAxisResponse(buffer: Uint8Array): { body: any, flags: number } {
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

function decodePlainResponse(buffer: Uint8Array): { body: any; raw: string } {
  const text = new TextDecoder().decode(buffer);
  try {
    return { body: JSON.parse(text), raw: text };
  } catch {
    return { body: text, raw: text };
  }
}

function decodeResponseBuffer(buffer: Uint8Array): {
  body: any;
  raw: string;
  effect: string;
} {
  if (buffer.length >= 5) {
    const magic = new TextDecoder().decode(buffer.slice(0, 5));
    if (magic === 'AXIS1') {
      const { body } = decodeAxisResponse(buffer);
      const effect =
        body?.effect ||
        body?.result?.effect ||
        (body?.ok === true ? 'OK' : 'COMPLETE');
      return { body, raw: '[BINARY AXIS FRAME]', effect };
    }
  }

  const plain = decodePlainResponse(buffer);
  const effect =
    plain.body?.effect ||
    plain.body?.result?.effect ||
    (plain.body?.ok === true ? 'OK' : 'COMPLETE');
  return { body: plain.body, raw: plain.raw, effect };
}

/* ── main send ───────────────────────────────────────────── */

export async function sendIntent(
  intent: string,
  body: unknown = {},
  nodeUrlOverride?: string,
  options?: { recordHistory?: boolean },
): Promise<SendResult> {
  const conn = useConnectionStore();
  const auth = useAuthStore();
  const history = useHistoryStore();

  const pid = generatePid();
  const nonce = generateNonce(32);
  const actorId = safeUuidToBytes(auth.actorId);
  const capsuleId = safeUuidToBytes(auth.capsuleId);
  const targetUrl = (nodeUrlOverride || conn.nodeUrl).replace(/\/+$/, '');

  const builder = new AxisFrameBuilder()
    .setPid(pid)
    .setTimestamp(BigInt(Date.now()))
    .setIntent(intent)
    .setActorId(actorId)
    .setProofType(ProofType.CAPSULE)
    .setProofRef(capsuleId)
    .setNonce(nonce)
    .setBody(encodeIntentBody(body));

  // Sign if we have an active key
  const activeKey = auth.getActiveKey();
  let frameBytes: Uint8Array;

  if (activeKey?.privateKeyHex) {
    const privKey = hexToBytes(activeKey.privateKeyHex);
    const unsigned = builder.buildUnsigned();
    const sig = await ed.signAsync(unsigned, privKey);
    frameBytes = builder.buildSigned(sig);
  } else {
    frameBytes = builder.buildUnsigned();
  }

  const start = performance.now();
  let result: SendResult;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/axis-bin',
        'Accept': 'application/axis-bin, application/json, text/plain'
      },
      body: frameBytes as any,
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Math.round(performance.now() - start);
    
    if (res.ok) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      const decoded = decodeResponseBuffer(buffer);
      
      result = {
        ok: true,
        status: res.status,
        durationMs,
        response: decoded.body,
        raw: decoded.raw,
        effect: decoded.effect,
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

  if (options?.recordHistory !== false) {
    history.push({
      id: bytesToHex(pid),
      ts: Date.now(),
      intent,
      requestBody: JSON.stringify(body, null, 2),
      responseBody: JSON.stringify(result.response, null, 2),
      responseEffect: result.effect,
      durationMs: result.durationMs,
      status: result.ok ? 'ok' : 'error',
      nodeUrl: targetUrl,
    });
  }

  return result;
}

/* ── catalog helpers ─────────────────────────────────────── */

export async function fetchCatalog(): Promise<any[]> {
  const res = await sendIntent('catalog.list', {});
  return res.ok ? (res.response?.intents || []) : [];
}

export async function describeIntent(intent: string): Promise<any> {
  const res = await sendIntent('catalog.describe', intent);
  return res.ok ? (res.response?.definition || null) : null;
}

export async function searchCatalog(query: string): Promise<any[]> {
  const res = await sendIntent('catalog.search', query);
  return res.ok ? (res.response?.intents || []) : [];
}
