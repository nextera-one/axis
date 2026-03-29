/**
 * AXIS REST Bridge
 * Converts REST-like requests into AXIS TLV capsule bytes.
 * Uses varint encoding (compatible with backend).
 */

import { TLV, encodeTLVs, tlvString, tlvU8, tlvU64, tlvBytes } from './axis-tlv';
import { AXIS_TAG, PROOF_TYPE } from './axis-tags';
import { generateNonce, generatePid } from '../binary/frame-builder';

const enc = new TextEncoder();

/** REST request shape */
export interface RestRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown; // object | string | Uint8Array | null
}

/** Options for AXIS capsule building */
export interface AxisBuildOptions {
  baseUrl?: string;
  intent?: string;
  actorId?: string; // Required for backend
  capsuleId?: Uint8Array; // 16-byte capsule ID
  includeHeaders?: boolean;
  maxHeaderBytes?: number;
}

/**
 * Infer intent from HTTP method + URL path.
 * Example: POST /v1/invoices -> rest.post.v1.invoices
 */
function inferIntent(method: string, urlObj: URL): string {
  const parts = urlObj.pathname
    .split('/')
    .filter(Boolean)
    .map((p) => (p.match(/^\d+$/) ? '_' : p.toLowerCase()));
  const path = parts.join('.') || 'root';
  return `rest.${method.toLowerCase()}.${path}`;
}

/**
 * Build body TLV from request body.
 * Returns JSON tag or BODY tag depending on content.
 */
function buildBodyTLV(body: unknown): TLV {
  if (body === null || body === undefined) {
    return tlvBytes(AXIS_TAG.BODY, new Uint8Array());
  }

  if (body instanceof Uint8Array) {
    return tlvBytes(AXIS_TAG.BODY, body);
  }

  if (typeof body === 'string') {
    return tlvBytes(AXIS_TAG.BODY, enc.encode(body));
  }

  // JSON-encode objects
  const json = JSON.stringify(body);
  return tlvBytes(AXIS_TAG.JSON, enc.encode(json));
}

/**
 * AxisRestBridge - Convert REST requests to AXIS-compatible frame headers.
 */
export class AxisRestBridge {
  /**
   * Convert a REST-ish request into AXIS frame header TLVs.
   * This produces headers compatible with axis-backend's buildPacket().
   */
  static restToAxisHeaders(req: RestRequest, opts: AxisBuildOptions = {}): TLV[] {
    const base = opts.baseUrl ?? 'http://localhost';
    const urlObj = new URL(req.url, base);

    const intent = opts.intent ?? inferIntent(req.method, urlObj);
    const pid = generatePid();
    const nonce = generateNonce();
    const ts = BigInt(Date.now());

    // Actor ID (required) - 16 bytes, defaults to zero if not provided
    const actorId = opts.actorId
      ? hexToBytes(opts.actorId)
      : new Uint8Array(16);

    // Header TLVs (matching backend expectations)
    const headerTLVs: TLV[] = [
      tlvBytes(AXIS_TAG.PID, pid),
      tlvU64(AXIS_TAG.TS, ts),
      tlvString(AXIS_TAG.INTENT, intent),
      tlvBytes(AXIS_TAG.ACTOR_ID, actorId),
      tlvU8(AXIS_TAG.PROOF_TYPE, PROOF_TYPE.CAPSULE),
      tlvBytes(AXIS_TAG.NONCE, nonce),
    ];

    // Add capsule ID if provided
    if (opts.capsuleId) {
      headerTLVs.push(tlvBytes(AXIS_TAG.PROOF_REF, opts.capsuleId));
    }

    return headerTLVs;
  }

  /**
   * Build body TLVs from REST request body.
   */
  static buildBody(req: RestRequest): TLV[] {
    if (req.body === null || req.body === undefined) {
      return [];
    }
    return [buildBodyTLV(req.body)];
  }

  /**
   * Encode headers to bytes (for frame construction).
   */
  static encodeHeaders(headers: TLV[]): Uint8Array {
    return encodeTLVs(headers);
  }

  /**
   * Encode body to bytes.
   */
  static encodeBody(bodyTLVs: TLV[]): Uint8Array {
    if (bodyTLVs.length === 0) {
      return new Uint8Array();
    }
    return encodeTLVs(bodyTLVs);
  }
}

/**
 * Helper: Convert hex string to bytes.
 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}
