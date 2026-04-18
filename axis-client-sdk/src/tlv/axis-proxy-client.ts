/**
 * AXIS Proxy Client
 * Client for sending REST-like requests via AXIS Proxy.
 * Uses varint TLV encoding (compatible with backend).
 */

import {
  AxisRestBridge,
  RestRequest,
  AxisBuildOptions,
} from './axis-rest-bridge';
import { signTlvFrame } from './axis-capsule-builder';
import { encodeFrame } from '../core/axis-bin';
import { AxisMediaTypes } from '../core/constants';
import type { Signer } from '../signer';

const dec = new TextDecoder();

/** REST-like response shape */
export interface RestResponseLike {
  status: number;
  headers: Record<string, string>;
  bodyBytes: Uint8Array;
  bodyText?: string;
  json?: unknown;
}

/** AXIS Proxy Client options */
export interface AxisProxyClientOptions {
  proxyUrl: string;
  baseUrl?: string;
  actorId: string; // Required: hex string actor ID
  capsuleId?: string; // Optional: hex string capsule ID
  signer?: Signer; // Optional: for signing requests
  timeoutMs?: number;
}

/**
 * AXIS Proxy Client
 * Converts REST requests to AXIS frames and sends to AXIS Proxy.
 */
export class AxisProxyClient {
  constructor(private readonly opts: AxisProxyClientOptions) {}

  /**
   * Build an AXIS frame from a REST request.
   * Returns the complete frame bytes.
   */
  async buildFrame(req: RestRequest): Promise<Uint8Array> {
    const buildOpts: AxisBuildOptions = {
      baseUrl: this.opts.baseUrl,
      actorId: this.opts.actorId,
      capsuleId: this.opts.capsuleId
        ? hexToBytes(this.opts.capsuleId)
        : undefined,
    };

    // Build header and body TLVs
    const headerTLVs = AxisRestBridge.restToAxisHeaders(req, buildOpts);
    const bodyTLVs = AxisRestBridge.buildBody(req);

    const headerBytes = AxisRestBridge.encodeHeaders(headerTLVs);
    const bodyBytes = AxisRestBridge.encodeBody(bodyTLVs);

    // Sign if signer is provided
    let signature: Uint8Array = new Uint8Array(0);
    if (this.opts.signer) {
      const sig = await signTlvFrame(headerBytes, bodyBytes, this.opts.signer);
      // Copy to ensure proper ArrayBuffer type
      signature = new Uint8Array(sig);
    }

    // Build AXIS frame (AXIS1 format)
    const flags = bodyTLVs.length > 0 ? 0x01 : 0x00; // BODY_TLV flag

    // Create headers Map with proper typing
    const headersMap = new Map<number, Uint8Array>();
    for (const t of headerTLVs) {
      headersMap.set(t.type, new Uint8Array(t.value));
    }

    return encodeFrame({
      flags,
      headers: headersMap,
      body: new Uint8Array(bodyBytes),
      sig: signature,
    });
  }

  /**
   * Send a REST-like request via AXIS Proxy.
   */
  async request(req: RestRequest): Promise<RestResponseLike> {
    const frameBytes = await this.buildFrame(req);

    const controller = this.opts.timeoutMs ? new AbortController() : undefined;
    const timer = this.opts.timeoutMs
      ? setTimeout(() => controller!.abort(), this.opts.timeoutMs)
      : undefined;

    try {
      // Create a fresh ArrayBuffer copy for fetch body compatibility
      const bodyBuffer = new ArrayBuffer(frameBytes.byteLength);
      new Uint8Array(bodyBuffer).set(frameBytes);

      const res = await fetch(this.opts.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': AxisMediaTypes.BINARY,
        },
        body: bodyBuffer,
        signal: controller?.signal,
      });

      const ab = await res.arrayBuffer();
      const bytes = new Uint8Array(ab);

      // Parse response
      const proxyHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (proxyHeaders[k.toLowerCase()] = v));

      const bodyText = safeDecodeText(bytes);
      const json = safeParseJson(bodyText);

      return {
        status: res.status,
        headers: proxyHeaders,
        bodyBytes: bytes,
        bodyText,
        json,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
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

function safeDecodeText(bytes: Uint8Array): string | undefined {
  try {
    return dec.decode(bytes);
  } catch {
    return undefined;
  }
}

function safeParseJson(text?: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
