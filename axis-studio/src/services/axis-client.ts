/**
 * AXIS Studio transport service.
 *
 * Builds AXIS1 request frames, sends them to the configured node, and keeps
 * contract-aware request/response snapshots for the studio viewer.
 */

import {
  AxisFrameBuilder,
  FrameFlags,
  ProofType,
  TLVType,
  bytesToUuid,
  decodeVarint,
  decodeTLVs,
  generateNonce,
  generatePid,
  uuidToBytes,
} from '@nextera.one/axis-client-sdk/browser';
import * as ed from '@noble/ed25519';

import { useAuthStore } from 'stores/auth';
import { useConnectionStore } from 'stores/connection';
import { useHistoryStore } from 'stores/history';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const EMPTY_16 = new Uint8Array(16);
const MAX_RAW_CHARS = 16_000;

type SnapshotTransport =
  | 'axis-bin'
  | 'json'
  | 'cce-response'
  | 'cce-error'
  | 'text'
  | 'binary';

export interface ProtocolSnapshot {
  transport: SnapshotTransport;
  tree: unknown;
  raw: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  durationMs: number;
  response: any;
  raw: string;
  effect: string;
  requestSnapshot: ProtocolSnapshot;
  responseSnapshot: ProtocolSnapshot;
  responseHeaders: Record<string, string>;
}

interface AxisFrameLike {
  flags: number;
  headers: Map<number, Uint8Array>;
  body: Uint8Array;
  sig: Uint8Array;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatHex(bytes: Uint8Array, columns = 16): string {
  if (!bytes.length) return '(empty)';
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += columns) {
    const row = Array.from(bytes.slice(i, i + columns))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    lines.push(row);
  }
  return lines.join('\n');
}

function truncateRaw(raw: string, limit = MAX_RAW_CHARS): string {
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}\n\n… truncated (${raw.length - limit} chars omitted)`;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryDecodeText(bytes: Uint8Array): string | null {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return null;
  }
}

function isProbablyText(text: string): boolean {
  return !/[\u0000-\u0008\u000e-\u001f]/.test(text);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '').replace(/[\s-]/g, '');
  if (!clean || clean.length % 2 !== 0 || /[^a-f0-9]/i.test(clean)) {
    throw new Error('Invalid hex key');
  }
  return new Uint8Array(
    clean.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}

function parsePrivateKeyHex(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return bytes.slice(-32);
  throw new Error('Unsupported private key length');
}

function safeActorIdToBytes(input: string | null | undefined): Uint8Array {
  if (!input) return EMPTY_16;
  try {
    return uuidToBytes(input);
  } catch {
    try {
      const bytes = hexToBytes(input);
      return bytes.length === 16 ? bytes : EMPTY_16;
    } catch {
      return EMPTY_16;
    }
  }
}

function safeProofRefToBytes(input: string | null | undefined): Uint8Array {
  if (!input) return EMPTY_16;
  try {
    return uuidToBytes(input);
  } catch {
    try {
      const bytes = hexToBytes(input);
      return bytes.length > 0 && bytes.length <= 64 ? bytes : EMPTY_16;
    } catch {
      return EMPTY_16;
    }
  }
}

function encodeIntentBody(body: unknown): Uint8Array {
  if (body instanceof Uint8Array) return body;
  if (typeof body === 'string') return textEncoder.encode(body);
  if (body === null || body === undefined) return new Uint8Array();
  return textEncoder.encode(JSON.stringify(body));
}

function readU64(bytes: Uint8Array): string {
  if (bytes.length !== 8) return bytesToHex(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, false).toString();
}

function proofTypeName(code: number | undefined): string {
  switch (code) {
    case ProofType.NONE:
      return 'NONE';
    case ProofType.CAPSULE:
      return 'CAPSULE';
    case ProofType.JWT:
      return 'JWT';
    case ProofType.MTLS:
      return 'MTLS';
    case ProofType.LOOM:
      return 'LOOM';
    case ProofType.WITNESS:
      return 'WITNESS';
    default:
      return `UNKNOWN_${code ?? 'NA'}`;
  }
}

function flagNames(flags: number): string[] {
  const names: string[] = [];
  if (flags & FrameFlags.BODY_IS_TLV) names.push('BODY_IS_TLV');
  if (flags & FrameFlags.RECEIPT_CHAINING) names.push('RECEIPT_CHAINING');
  if (flags & FrameFlags.WITNESS_INCLUDED) names.push('WITNESS_INCLUDED');
  if (flags & FrameFlags.COMPRESSED) names.push('COMPRESSED');
  return names;
}

function headerName(tag: number): string {
  const name = TLVType[tag as keyof typeof TLVType];
  return typeof name === 'string' ? name : `TAG_${tag}`;
}

function decodeHeaderValue(tag: number, bytes: Uint8Array): unknown {
  switch (tag) {
    case TLVType.PID:
    case TLVType.ACTOR_ID:
      return bytes.length === 16 ? bytesToUuid(bytes) : bytesToHex(bytes);
    case TLVType.TS:
      return readU64(bytes);
    case TLVType.INTENT:
    case TLVType.REALM:
    case TLVType.NODE:
    case TLVType.KID:
    case TLVType.EFFECT:
    case TLVType.ERROR_CODE:
    case TLVType.ERROR_MSG:
    case TLVType.NODE_KID: {
      const text = tryDecodeText(bytes);
      return text && isProbablyText(text) ? text : bytesToHex(bytes);
    }
    case TLVType.PROOF_TYPE:
      return { code: bytes[0] ?? null, label: proofTypeName(bytes[0]) };
    case TLVType.OK:
      return bytes[0] === 1;
    default: {
      const text = tryDecodeText(bytes);
      if (text && isProbablyText(text)) return text;
      return bytesToHex(bytes);
    }
  }
}

function decodeTlvCollection(bytes: Uint8Array) {
  const tlvs = decodeTLVs(bytes);
  return Array.from(tlvs.entries()).map(([tag, value]) => ({
    tag,
    name: headerName(tag),
    decoded: decodeHeaderValue(tag, value),
    rawHex: bytesToHex(value),
    byteLength: value.length,
  }));
}

function decodeAxisFrame(bytes: Uint8Array): AxisFrameLike {
  const magic = tryDecodeText(bytes.slice(0, 5));
  if (magic !== 'AXIS1') {
    throw new Error('Invalid AXIS frame magic');
  }

  const version = bytes[5];
  if (version !== 1) {
    throw new Error(`Unsupported AXIS version: ${version}`);
  }

  const flags = bytes[6] ?? 0;
  let offset = 7;

  const hdrLenToken = decodeVarint(bytes, offset);
  const hdrLen = Number(hdrLenToken.value);
  offset = hdrLenToken.offset;

  const bodyLenToken = decodeVarint(bytes, offset);
  const bodyLen = Number(bodyLenToken.value);
  offset = bodyLenToken.offset;

  const sigLenToken = decodeVarint(bytes, offset);
  const sigLen = Number(sigLenToken.value);
  offset = sigLenToken.offset;

  const end = offset + hdrLen + bodyLen + sigLen;
  if (end > bytes.length) {
    throw new Error('AXIS frame truncated');
  }

  const headerBytes = bytes.slice(offset, offset + hdrLen);
  offset += hdrLen;

  const body = bytes.slice(offset, offset + bodyLen);
  offset += bodyLen;

  const sig = bytes.slice(offset, offset + sigLen);

  return {
    flags,
    headers: decodeTLVs(headerBytes),
    body,
    sig,
  };
}

function decodeBody(bytes: Uint8Array, flags: number) {
  if (!bytes.length) {
    return { format: 'empty', byteLength: 0, parsed: null };
  }

  if (flags & FrameFlags.BODY_IS_TLV) {
    try {
      return {
        format: 'tlv',
        byteLength: bytes.length,
        parsed: decodeTlvCollection(bytes),
      };
    } catch (error) {
      return {
        format: 'tlv',
        byteLength: bytes.length,
        error: error instanceof Error ? error.message : 'TLV decode failed',
        rawHex: bytesToHex(bytes),
      };
    }
  }

  const text = tryDecodeText(bytes);
  if (text !== null && isProbablyText(text)) {
    const json = safeParseJson(text);
    if (json !== undefined) {
      return {
        format: 'json',
        byteLength: bytes.length,
        parsed: json,
        text,
      };
    }
    return {
      format: 'text',
      byteLength: bytes.length,
      parsed: text,
      text,
    };
  }

  return {
    format: 'binary',
    byteLength: bytes.length,
    parsed: { hex: bytesToHex(bytes) },
    rawHex: bytesToHex(bytes),
  };
}

function getHeaderText(headers: Map<number, Uint8Array>, tag: number): string | undefined {
  const value = headers.get(tag);
  if (!value) return undefined;
  const text = tryDecodeText(value);
  return text && isProbablyText(text) ? text : undefined;
}

function buildAxisFrameView(
  frameBytes: Uint8Array,
  options: {
    direction: 'request' | 'response';
    endpoint?: string;
    http?: Record<string, unknown>;
    fallbackIntent?: string;
  },
): ProtocolSnapshot {
  const frame = decodeAxisFrame(frameBytes);
  const body = decodeBody(frame.body, frame.flags);

  return {
    transport: 'axis-bin',
    raw: truncateRaw(formatHex(frameBytes)),
    tree: {
      direction: options.direction,
      transport: 'axis-bin',
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.http ? { http: options.http } : {}),
      intent:
        options.fallbackIntent ??
        getHeaderText(frame.headers, TLVType.INTENT) ??
        null,
      frame: {
        version: 1,
        byteLength: frameBytes.length,
        flags: {
          value: frame.flags,
          names: flagNames(frame.flags),
        },
        headers: Array.from(frame.headers.entries()).map(([tag, value]) => ({
          tag,
          name: headerName(tag),
          decoded: decodeHeaderValue(tag, value),
          rawHex: bytesToHex(value),
          byteLength: value.length,
        })),
        body,
        signature: {
          present: frame.sig.length > 0,
          byteLength: frame.sig.length,
          hex: frame.sig.length ? bytesToHex(frame.sig) : null,
        },
      },
    },
  };
}

function buildRequestSnapshot(
  frameBytes: Uint8Array,
  intent: string,
  targetUrl: string,
  body: unknown,
  requestHeaders: Record<string, string>,
): ProtocolSnapshot {
  const snapshot = buildAxisFrameView(frameBytes, {
    direction: 'request',
    endpoint: targetUrl,
    fallbackIntent: intent,
    http: {
      method: 'POST',
      url: targetUrl,
      headers: requestHeaders,
    },
  });

  return {
    ...snapshot,
    tree: {
      ...(snapshot.tree as Record<string, unknown>),
      payload: body ?? null,
    },
  };
}

function responseTransportForJson(json: Record<string, unknown>): SnapshotTransport {
  if (json.ver === 'cce-v1' && 'response_id' in json) return 'cce-response';
  if (json.ver === 'cce-v1' && 'request_id' in json && 'error' in json) return 'cce-error';
  return 'json';
}

function buildPlainResponseSnapshot(
  buffer: Uint8Array,
  status: number,
  headers: Record<string, string>,
): {
  body: any;
  raw: string;
  effect: string;
  snapshot: ProtocolSnapshot;
} {
  const text = tryDecodeText(buffer);

  if (text !== null && isProbablyText(text)) {
    const json = safeParseJson(text);
    if (json !== undefined && json && typeof json === 'object') {
      const transport = responseTransportForJson(json as Record<string, unknown>);
      const effect = extractEffect(json, status);
      return {
        body: json,
        raw: truncateRaw(text),
        effect,
        snapshot: {
          transport,
          raw: truncateRaw(text),
          tree: {
            transport,
            http: {
              status,
              ok: status >= 200 && status < 300,
              headers,
            },
            envelope: json,
          },
        },
      };
    }

    return {
      body: text,
      raw: truncateRaw(text),
      effect: status >= 400 ? 'ERROR' : 'COMPLETE',
      snapshot: {
        transport: 'text',
        raw: truncateRaw(text),
        tree: {
          transport: 'text',
          http: {
            status,
            ok: status >= 200 && status < 300,
            headers,
          },
          body: text,
        },
      },
    };
  }

  const rawHex = formatHex(buffer);
  return {
    body: { hex: bytesToHex(buffer) },
    raw: truncateRaw(rawHex),
    effect: status >= 400 ? 'ERROR' : 'BINARY',
    snapshot: {
      transport: 'binary',
      raw: truncateRaw(rawHex),
      tree: {
        transport: 'binary',
        http: {
          status,
          ok: status >= 200 && status < 300,
          headers,
        },
        byteLength: buffer.length,
        hex: bytesToHex(buffer),
      },
    },
  };
}

function extractAxisBody(frame: AxisFrameLike): any {
  const body = decodeBody(frame.body, frame.flags);
  return body.parsed ?? null;
}

function extractEffect(body: any, status?: number, frame?: AxisFrameLike): string {
  const headerEffect = frame ? getHeaderText(frame.headers, TLVType.EFFECT) : undefined;
  if (headerEffect) return headerEffect;

  if (body && typeof body === 'object') {
    const objectBody = body as Record<string, any>;
    if (typeof objectBody.effect === 'string') return objectBody.effect;
    if (typeof objectBody.status === 'string') return objectBody.status;
    if (typeof objectBody.code === 'string') return objectBody.code;
    if (
      objectBody.result &&
      typeof objectBody.result === 'object' &&
      typeof objectBody.result.effect === 'string'
    ) {
      return objectBody.result.effect;
    }
    if (
      objectBody.error &&
      typeof objectBody.error === 'object' &&
      typeof objectBody.error.code === 'string'
    ) {
      return objectBody.error.code;
    }
  }

  if (status !== undefined && status >= 400) return 'ERROR';
  return 'COMPLETE';
}

function decodeResponseBuffer(
  buffer: Uint8Array,
  status: number,
  headers: Record<string, string>,
): {
  body: any;
  raw: string;
  effect: string;
  snapshot: ProtocolSnapshot;
} {
  if (buffer.length >= 5) {
    const magic = tryDecodeText(buffer.slice(0, 5));
    if (magic === 'AXIS1') {
      const frame = decodeAxisFrame(buffer);
      const body = extractAxisBody(frame);
      return {
        body,
        raw: truncateRaw(formatHex(buffer)),
        effect: extractEffect(body, status, frame),
        snapshot: buildAxisFrameView(buffer, {
          direction: 'response',
          http: {
            status,
            ok: status >= 200 && status < 300,
            headers,
          },
        }),
      };
    }
  }

  return buildPlainResponseSnapshot(buffer, status, headers);
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
  const actorId = safeActorIdToBytes(auth.actorId);
  const hasCapsule = Boolean(auth.capsuleId?.trim());
  const proofRef = hasCapsule ? safeProofRefToBytes(auth.capsuleId) : EMPTY_16;
  const targetUrl = (nodeUrlOverride || conn.nodeUrl).replace(/\/+$/, '');

  const builder = new AxisFrameBuilder()
    .setPid(pid)
    .setTimestamp(BigInt(Date.now()))
    .setIntent(intent)
    .setActorId(actorId)
    .setProofType(hasCapsule ? ProofType.CAPSULE : ProofType.NONE)
    .setProofRef(proofRef)
    .setNonce(nonce)
    .setBody(encodeIntentBody(body));

  const activeKey = auth.getActiveKey();
  let frameBytes: Uint8Array;

  if (activeKey?.privateKeyHex) {
    const privKey = parsePrivateKeyHex(activeKey.privateKeyHex);
    const unsigned = builder.buildUnsigned();
    const sig = await ed.signAsync(unsigned, privKey);
    frameBytes = builder.buildSigned(sig);
  } else {
    frameBytes = builder.buildUnsigned();
  }

  const requestHeaders = {
    'Content-Type': 'application/axis-bin',
    Accept: 'application/axis-bin, application/json, text/plain',
  };
  const requestSnapshot = buildRequestSnapshot(
    frameBytes,
    intent,
    targetUrl,
    body,
    requestHeaders,
  );

  const start = performance.now();
  let result: SendResult;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: frameBytes as BodyInit,
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Math.round(performance.now() - start);
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const buffer = new Uint8Array(await res.arrayBuffer());
    const decoded = decodeResponseBuffer(buffer, res.status, responseHeaders);

    result = {
      ok: res.ok,
      status: res.status,
      durationMs,
      response: decoded.body,
      raw: decoded.raw,
      effect: decoded.effect,
      requestSnapshot,
      responseSnapshot: decoded.snapshot,
      responseHeaders,
    };
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    const message = error?.message || 'Request failed';
    result = {
      ok: false,
      status: 0,
      durationMs,
      response: { error: message },
      raw: message,
      effect: 'ERROR',
      requestSnapshot,
      responseSnapshot: {
        transport: 'text',
        raw: message,
        tree: {
          transport: 'text',
          http: { status: 0, ok: false, headers: {} },
          error: message,
        },
      },
      responseHeaders: {},
    };
  }

  if (options?.recordHistory !== false) {
    history.push({
      id: bytesToHex(pid),
      ts: Date.now(),
      intent,
      requestBody: safeStringify(body),
      responseBody: safeStringify(result.response),
      responseEffect: result.effect,
      durationMs: result.durationMs,
      status: result.ok ? 'ok' : 'error',
      nodeUrl: targetUrl,
      httpStatus: result.status,
      requestSnapshot: {
        transport: result.requestSnapshot.transport,
        tree: result.requestSnapshot.tree,
        raw: truncateRaw(result.requestSnapshot.raw),
      },
      responseSnapshot: {
        transport: result.responseSnapshot.transport,
        tree: result.responseSnapshot.tree,
        raw: truncateRaw(result.responseSnapshot.raw),
      },
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
