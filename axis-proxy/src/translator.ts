import { AXIS_MAGIC, encodeFrame, TLV_ACTOR_ID, TLV_INTENT, TLV_KID, TLV_NONCE, TLV_PID, TLV_PROOF_REF, TLV_PROOF_TYPE, TLV_TRACE_ID, TLV_TS } from "@nextera.one/axis-client-sdk/core";
import { randomBytes } from "crypto";

import { CircuitBreaker } from "./middleware/circuit-breaker";
/**
 * AXIS Protocol Translator
 *
 * Translates REST requests to AXIS binary frames and forwards to backend.
 * Self-contained implementation without external dependencies.
 */
import { ProxyConfig } from "./config";

export interface TranslateRequest {
  intent: string;
  actorId: string;
  proofType: number;
  capsuleId?: string;
  body: Record<string, unknown>;
  ip: string;
  correlationId?: string;
  /** NestFlow: Key ID for device-signed requests */
  kid?: string;
  /** NestFlow: Session ID for session-scoped requests */
  sessionId?: string;
  /** NestFlow: Device UID for device-scoped requests */
  deviceUid?: string;
  /** NestFlow: Identity UID for identity-scoped requests */
  identityUid?: string;
  /** NestFlow: Auth level (SESSION, SESSION_BROWSER, STEP_UP, PRIMARY_DEVICE) */
  authLevel?: string;
  /** NestFlow: Trust mode requested by browser login */
  requestedTrust?: "ephemeral_session" | "trusted_device";
  /** NestFlow: Temporal coordinate used in TickAuth */
  tpsCoordinate?: string;
  /** NestFlow: Header-derived body fields for QR helper flows */
  bodyAugment?: Record<string, unknown>;
}

export interface TranslateResponse {
  statusCode: number;
  body: Record<string, unknown> | Buffer;
  headers?: Record<string, string>;
}

export class AxisTranslator {
  private config: ProxyConfig;
  private circuitBreaker?: CircuitBreaker;

  constructor(config: ProxyConfig, circuitBreaker?: CircuitBreaker) {
    this.config = config;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Translate REST request to AXIS binary and forward to backend
   */
  async translateAndForward(
    request: TranslateRequest,
  ): Promise<TranslateResponse> {
    try {
      // Build AXIS frame
      const frame = this.buildFrame(request);

      // Forward to backend (with circuit breaker if available)
      const response = this.circuitBreaker
        ? await this.circuitBreaker.execute(() =>
            this.sendToBackend(frame, request.correlationId),
          )
        : await this.sendToBackend(frame, request.correlationId);

      // Parse response
      return this.parseResponse(response);
    } catch (error: any) {
      // Re-throw circuit breaker errors
      if (error.name === "CircuitOpenError") {
        throw error;
      }

      console.error(`Translation error for ${request.intent}:`, error.message);
      return {
        statusCode: 500,
        body: {
          error: "TRANSLATION_ERROR",
          message: error.message,
          intent: request.intent,
        },
      };
    }
  }

  /**
   * Forward raw binary frame to backend
   */
  async forwardBinary(
    frame: Buffer,
    ip: string,
    correlationId?: string,
  ): Promise<TranslateResponse> {
    try {
      // Validate frame magic
      if (!this.validateMagic(frame)) {
        return {
          statusCode: 400,
          body: {
            error: "INVALID_MAGIC",
            message: "Frame does not have valid AXIS magic bytes",
          },
        };
      }

      // Forward with circuit breaker if available
      const response = this.circuitBreaker
        ? await this.circuitBreaker.execute(() =>
            this.sendToBackend(frame, correlationId),
          )
        : await this.sendToBackend(frame, correlationId);

      return {
        statusCode: response.status,
        body: response.data,
      };
    } catch (error: any) {
      // Re-throw circuit breaker errors
      if (error.name === "CircuitOpenError") {
        throw error;
      }

      return {
        statusCode: 502,
        body: {
          error: "BACKEND_ERROR",
          message: error.message,
        },
      };
    }
  }

  /**
   * Build AXIS frame from REST request
   */
  private buildFrame(request: TranslateRequest): Buffer {
    const actorIdBytes = this.hexToBytes(request.actorId);
    const nonce = randomBytes(16);
    const pid = this.generatePid();

    // Build header TLVs
    const headers = new Map<number, Uint8Array>();

    headers.set(TLV_PID, pid);

    const tsBuffer = new Uint8Array(8);
    new DataView(tsBuffer.buffer).setBigUint64(0, BigInt(Date.now()), false);
    headers.set(TLV_TS, tsBuffer);

    headers.set(TLV_INTENT, new TextEncoder().encode(request.intent));
    headers.set(TLV_ACTOR_ID, actorIdBytes);
    headers.set(TLV_PROOF_TYPE, new Uint8Array([request.proofType]));

    if (request.capsuleId) {
      headers.set(TLV_PROOF_REF, this.hexToBytes(request.capsuleId));
    }

    headers.set(TLV_NONCE, nonce);

    // NestFlow: Include KID if provided (device key identifier)
    if (request.kid) {
      headers.set(TLV_KID, new TextEncoder().encode(request.kid));
    }

    // NestFlow: Include correlation/trace ID
    if (request.correlationId) {
      headers.set(
        TLV_TRACE_ID,
        new TextEncoder().encode(request.correlationId),
      );
    }

    // Merge NestFlow context into body before encoding
    const bodyPayload: Record<string, unknown> = {
      ...(request.bodyAugment ?? {}),
      ...request.body,
    };
    if (request.sessionId) bodyPayload._sessionId = request.sessionId;
    if (request.deviceUid) bodyPayload._deviceUid = request.deviceUid;
    if (request.identityUid) bodyPayload._identityUid = request.identityUid;
    if (request.authLevel) bodyPayload._authLevel = request.authLevel;
    if (request.requestedTrust)
      bodyPayload._requestedTrust = request.requestedTrust;
    if (request.tpsCoordinate)
      bodyPayload._tpsCoordinate = request.tpsCoordinate;

    // Build body
    const bodyBytes = new TextEncoder().encode(JSON.stringify(bodyPayload));

    // Use SDK to encode
    const frameBytes = encodeFrame({
      flags: 0, // Unsigned by proxy (client signed usually, or proxy signs?) Spec says client.
      headers,
      body: bodyBytes,
      sig: new Uint8Array(0),
    });

    return Buffer.from(frameBytes);
  }

  /**
   * Send frame to backend
   */
  private async sendToBackend(
    frame: Buffer,
    correlationId?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {
      "Content-Type": "application/axis-bin",
      "Content-Length": frame.length.toString(),
    };

    if (correlationId) {
      headers["X-Correlation-Id"] = correlationId;
    }

    const response = await fetch(this.config.backendUrl, {
      method: "POST",
      headers,
      body: frame,
    });

    // Try to parse as JSON, otherwise return raw
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return {
        status: response.status,
        data: await response.json(),
      };
    } else {
      return {
        status: response.status,
        data: Buffer.from(await response.arrayBuffer()),
      };
    }
  }

  /**
   * Parse backend response
   */
  private parseResponse(response: any): TranslateResponse {
    return {
      statusCode: response.status || 200,
      body: response.data || {},
    };
  }

  /**
   * Validate AXIS magic bytes
   */
  private validateMagic(frame: Buffer): boolean {
    if (frame.length < 5) return false;
    // AXIS_MAGIC is Uint8Array from SDK, frame is Buffer.
    // Buffer acts as Uint8Array, so we can compare bytes.
    for (let i = 0; i < 5; i++) {
      if (frame[i] !== AXIS_MAGIC[i]) return false;
    }
    return true;
  }

  /**
   * Generate UUIDv7-like packet ID
   */
  private generatePid(): Uint8Array {
    const pid = new Uint8Array(16);
    const now = BigInt(Date.now());
    const view = new DataView(pid.buffer);
    view.setBigUint64(0, now, false);
    const random = randomBytes(8);
    pid.set(random, 8);
    return pid;
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
    // Pad to 32 chars (16 bytes) if needed
    const paddedHex = cleanHex.padStart(32, "0");
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = parseInt(paddedHex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
}
