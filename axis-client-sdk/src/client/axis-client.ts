import * as ed from '@noble/ed25519';
import { createHash, randomBytes } from 'crypto';
/**
 * AXIS Client with Retry, Progress, and Resume Support
 */
import axios, { AxiosProgressEvent } from 'axios';
import * as path from 'path';
import { ulid } from 'ulid';
import * as fs from 'fs';

import {
  AxisFrameBuilder,
  generateNonce,
  generatePid,
  uuidToBytes,
} from '../binary/frame-builder';
import { ProofType } from '../binary/binary-types';
import {
  encodeChainRequest,
} from '../chain/binary-chain';
import {
  type AxisChainEnvelope,
  type AxisChainRequest,
  type AxisChainResult,
} from '../chain/intent-chain';
import type { Capsule, SerializedCapsule } from '../core/capsule';
import { serializeCapsule } from '../core/capsule';
import { canonicalJson, fromBase64Url, toBase64Url } from '../utils/encoding';
import { decodeFrame } from '../core/axis-bin';
import { Signer } from '../signer';

export interface AxisClientConfig {
  /** Base URL of AXIS service (without path); we append /axis/ingress by default */
  baseUrl: string;
  /** Actor ID used in frames (e.g., actor:user_123 or svc:core) */
  actorId: string;
  /** Audience binding (defaults to axis-core) */
  audience?: string;
  /** Optional capsule for INTENT.EXEC */
  capsuleId?: string;
  /** Optional signer for frame signing (Ed25519) */
  signer?: Signer;
  /** Key ID for the signer (required if signer is set) */
  signerKid?: string;
  /** Max retries for transport errors */
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
  /** Whether to send legacy binary frames (disabled by default) */
  useBinary?: boolean;
}

export interface ProgressCallback {
  (progress: ProgressInfo): void;
}

export interface ProgressInfo {
  phase: 'init' | 'upload' | 'finalize';
  current: number;
  total: number;
  percent: number;
  bytesTransferred?: number;
  bytesTotal?: number;
  currentChunk?: number;
  totalChunks?: number;
}

export interface UploadResult {
  fileId: string;
  path: string;
  hash: string;
  verified: boolean;
  size: number;
}

export interface IntentResult<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  receipt?: any;
}

type AxisAlg = 'EdDSA';

interface AxisSig {
  alg: AxisAlg;
  kid: string;
  value: string; // base64url signature
}

export interface AxisFrame {
  v: 1;
  pid: string;
  nonce: string;
  ts: number;
  actorId: string;
  aud?: string;
  opcode: string;
  body: any;
  sig?: AxisSig;
}

export class AxisClient {
  private config: {
    baseUrl: string;
    actorId: string;
    audience: string;
    signerKid?: string;
    capsuleId: string;
    signer?: Signer;
    maxRetries: number;
    retryDelayMs: number;
    timeout: number;
    useBinary: boolean;
  };

  constructor(config: AxisClientConfig) {
    this.config = {
      baseUrl: this.normalizeBaseUrl(config.baseUrl),
      actorId: config.actorId,
      audience: config.audience ?? 'axis-core',
      signerKid: config.signerKid,
      capsuleId: config.capsuleId || '',
      signer: config.signer,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      timeout: config.timeout ?? 30000,
      useBinary: config.useBinary ?? false,
    };
  }

  /**
   * Send an intent with automatic retry
   */
  async send<T = any>(intent: string, body?: any): Promise<IntentResult<T>> {
    return this.withRetries(() => this.doSend(intent, body));
  }

  /**
   * Helper for INTENT.EXEC
   * body shape: { intent, capsule, execNonce, args }
   */
  async exec<T = any>(
    intent: string,
    args?: any,
    options?: {
      capsule?: any;
      execNonce?: string;
    },
  ): Promise<IntentResult<T>> {
    const capsule = options?.capsule ?? (this.config.capsuleId || undefined);
    const execNonce = options?.execNonce ?? this.generateExecNonce();

    const payload: Record<string, any> = {
      intent,
      execNonce,
      args: args ?? {},
    };

    if (capsule) {
      payload.capsule = capsule;
    }

    return this.send('INTENT.EXEC', payload);
  }

  /**
   * Helper for CHAIN.EXEC
   */
  async chain<T = AxisChainResult>(
    envelope: AxisChainEnvelope,
    options?: {
      capsule?: Capsule | SerializedCapsule | Record<string, unknown>;
      actorId?: string;
    },
  ): Promise<IntentResult<T>> {
    const request: AxisChainRequest<
      unknown,
      SerializedCapsule | Record<string, unknown>
    > = {
      envelope,
      actorId: options?.actorId,
      capsule: this.normalizeCapsulePayload(options?.capsule),
    };

    if (!this.config.useBinary) {
      return this.send<T>('CHAIN.EXEC', request);
    }

    const body = encodeChainRequest(request);
    const capsuleId =
      this.extractCapsuleId(request.capsule) || this.config.capsuleId || undefined;

    return this.withRetries(() =>
      this.doSendBinaryRaw('CHAIN.EXEC', body, {
        chainReq: true,
        capsuleId,
      }) as Promise<T>,
    );
  }

  /**
   * Upload file with chunked upload, resume support, and progress
   */
  async uploadFile(
    filePath: string,
    options?: {
      chunkSize?: number;
      resumeFileId?: string;
      onProgress?: ProgressCallback;
    },
  ): Promise<UploadResult> {
    const absPath = path.resolve(filePath);
    const stat = fs.statSync(absPath);
    const filename = path.basename(absPath);
    const chunkSize = options?.chunkSize || 1024 * 1024; // 1MB default
    const totalChunks = Math.ceil(stat.size / chunkSize);
    const onProgress = options?.onProgress;

    // Phase 1: Initialize or resume
    onProgress?.({ phase: 'init', current: 0, total: 1, percent: 0 });

    let fileId = options?.resumeFileId;
    let missingChunks: number[] = [];

    if (!fileId) {
      // Initialize new upload
      const initResult = await this.send<{ fileId: string }>('file.init', {
        filename,
        size: stat.size,
        chunkSize,
      });

      if (!initResult.ok || !initResult.data?.fileId) {
        throw new Error(`Init failed: ${initResult.error}`);
      }

      fileId = initResult.data.fileId;
      missingChunks = Array.from({ length: totalChunks }, (_, i) => i);
    } else {
      // Resume - get status
      const statusResult = await this.send<{ missingChunks: number[] }>(
        'file.status',
        { fileId },
      );

      if (!statusResult.ok) {
        throw new Error(`Status failed: ${statusResult.error}`);
      }

      missingChunks = statusResult.data?.missingChunks || [];
    }

    onProgress?.({ phase: 'init', current: 1, total: 1, percent: 100 });

    // Phase 2: Upload chunks with progress
    const fd = fs.openSync(absPath, 'r');
    const buffer = Buffer.alloc(chunkSize);
    let bytesTransferred = (totalChunks - missingChunks.length) * chunkSize;

    try {
      for (let i = 0; i < missingChunks.length; i++) {
        const chunkIndex = missingChunks[i];
        const offset = chunkIndex * chunkSize;
        const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, offset);
        const chunk = buffer.subarray(0, bytesRead);

        onProgress?.({
          phase: 'upload',
          current: i,
          total: missingChunks.length,
          percent: Math.round((i / missingChunks.length) * 100),
          bytesTransferred,
          bytesTotal: stat.size,
          currentChunk: chunkIndex,
          totalChunks,
        });

        // Upload chunk with retry
        const chunkResult = await this.send('file.chunk', {
          fileId,
          index: chunkIndex,
          data: chunk.toString('base64'),
        });

        if (!chunkResult.ok) {
          throw new Error(`Chunk ${chunkIndex} failed: ${chunkResult.error}`);
        }

        bytesTransferred += bytesRead;
      }
    } finally {
      fs.closeSync(fd);
    }

    onProgress?.({
      phase: 'upload',
      current: missingChunks.length,
      total: missingChunks.length,
      percent: 100,
      bytesTransferred: stat.size,
      bytesTotal: stat.size,
    });

    // Phase 3: Finalize
    onProgress?.({ phase: 'finalize', current: 0, total: 1, percent: 0 });

    const hash = await this.computeFileHash(absPath);
    const finalResult = await this.send<UploadResult>('file.finalize', {
      fileId,
      expectedHash: hash,
    });

    if (!finalResult.ok || !finalResult.data) {
      throw new Error(`Finalize failed: ${finalResult.error}`);
    }

    onProgress?.({ phase: 'finalize', current: 1, total: 1, percent: 100 });

    return finalResult.data;
  }

  /**
   * Download file with range support and progress
   */
  async downloadFile(
    fileId: string,
    destPath: string,
    options?: {
      onProgress?: ProgressCallback;
    },
  ): Promise<void> {
    const onProgress = options?.onProgress;
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per request

    // Get first chunk to determine size
    const firstResult = await this.send<{
      data: string;
      size: number;
      hasMore: boolean;
    }>('file.get', { fileId, rangeStart: 0, rangeEnd: CHUNK_SIZE });

    if (!firstResult.ok || !firstResult.data) {
      throw new Error(`Download failed: ${firstResult.error}`);
    }

    const totalSize = firstResult.data.size;
    const fd = fs.openSync(destPath, 'w');
    let offset = 0;

    try {
      // Write first chunk
      const firstChunk = Buffer.from(firstResult.data.data, 'base64');
      fs.writeSync(fd, firstChunk, 0, firstChunk.length, 0);
      offset = firstChunk.length;

      onProgress?.({
        phase: 'upload',
        current: offset,
        total: totalSize,
        percent: Math.round((offset / totalSize) * 100),
        bytesTransferred: offset,
        bytesTotal: totalSize,
      });

      // Continue downloading remaining chunks
      while (offset < totalSize) {
        const result = await this.send<{ data: string; hasMore: boolean }>(
          'file.get',
          {
            fileId,
            rangeStart: offset,
            rangeEnd: offset + CHUNK_SIZE,
          },
        );

        if (!result.ok || !result.data) {
          throw new Error(`Download chunk failed: ${result.error}`);
        }

        const chunk = Buffer.from(result.data.data, 'base64');
        fs.writeSync(fd, chunk, 0, chunk.length, offset);
        offset += chunk.length;

        onProgress?.({
          phase: 'upload',
          current: offset,
          total: totalSize,
          percent: Math.round((offset / totalSize) * 100),
          bytesTransferred: offset,
          bytesTotal: totalSize,
        });
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  /**
   * Subscribe to stream with polling
   */
  async streamTail(
    topic: string,
    callback: (event: any) => void,
    options?: {
      pollIntervalMs?: number;
      fromOffset?: number;
    },
  ): Promise<() => void> {
    let running = true;
    let offset = options?.fromOffset || 0;
    const pollInterval = options?.pollIntervalMs || 2000;

    const poll = async () => {
      while (running) {
        try {
          const result = await this.send<{ events: any[] }>('stream.read', {
            topic,
            fromOffset: offset,
            limit: 100,
          });

          if (result.ok && result.data?.events?.length) {
            for (const event of result.data.events) {
              callback(event);
              offset = event.offset + 1;
            }
          }
        } catch (error) {
          // Silently retry on error
        }

        await this.delay(pollInterval);
      }
    };

    poll(); // Start polling in background

    return () => {
      running = false;
    };
  }

  // Private methods
  private async doSend(intent: string, body?: any): Promise<any> {
    if (this.config.useBinary) {
      return this.doSendBinary(intent, body);
    }
    return this.doSendJSON(intent, body);
  }

  private async withRetries<T>(
    operation: () => Promise<T>,
  ): Promise<IntentResult<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        return { ok: true, data: result };
      } catch (error: any) {
        lastError = error;

        if (error.response?.status >= 400 && error.response?.status < 500) {
          return {
            ok: false,
            error: error.response?.data?.error || error.message,
          };
        }

        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelayMs * (attempt + 1));
        }
      }
    }

    return { ok: false, error: lastError?.message || 'Unknown error' };
  }

  private async doSendJSON(intent: string, body?: any): Promise<any> {
    const frame = await this.buildJsonFrame(intent, body || {});

    const response = await axios.post(this.config.baseUrl, frame, {
      headers: { 'Content-Type': 'application/json' },
      timeout: this.config.timeout,
    });

    return response.data;
  }

  private async doSendBinary(intent: string, body?: any): Promise<any> {
    return this.doSendBinaryRaw(intent, this.encodeBody(body), {
      chainReq: intent === 'CHAIN.EXEC' || intent === 'axis.chain.exec',
      capsuleId: this.config.capsuleId || undefined,
    });
  }

  private async doSendBinaryRaw(
    intent: string,
    body: Uint8Array,
    options?: {
      chainReq?: boolean;
      capsuleId?: string;
    },
  ): Promise<any> {
    const proofRef = this.resolveProofRef(options?.capsuleId);
    const builder = new AxisFrameBuilder()
      .setPid(generatePid())
      .setTimestamp(BigInt(Date.now()))
      .setIntent(intent)
      .setActorId(uuidToBytes(this.config.actorId))
      .setProofType(ProofType.CAPSULE)
      .setProofRef(proofRef)
      .setNonce(generateNonce())
      .setBody(body)
      .setFlags(false, options?.chainReq ?? false, false);

    let frame: Uint8Array;
    if (this.config.signer) {
      const unsignedFrame = builder.buildUnsigned();
      const signature = await this.config.signer.sign(unsignedFrame);
      frame = builder.buildSigned(new Uint8Array(signature));
    } else {
      frame = builder.buildUnsigned();
    }

    const response = await axios.post(this.config.baseUrl, frame, {
      headers: { 'Content-Type': 'application/axis-bin' },
      responseType: 'arraybuffer',
      timeout: this.config.timeout,
    });

    return this.parseBinaryResponse(response.data);
  }

  private parseBinaryResponse(payload: ArrayBuffer | Uint8Array): any {
    const responseBytes = payload instanceof Uint8Array
      ? payload
      : new Uint8Array(payload);

    try {
      const respFrame = decodeFrame(responseBytes);
      if (respFrame.body.length === 0) {
        return null;
      }

      try {
        return JSON.parse(new TextDecoder().decode(respFrame.body));
      } catch {
        return respFrame.body;
      }
    } catch {
      return JSON.parse(new TextDecoder().decode(responseBytes));
    }
  }

  private encodeBody(body?: any): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(body || {}));
  }

  private resolveProofRef(capsuleId?: string): Uint8Array {
    if (capsuleId) {
      return uuidToBytes(capsuleId);
    }
    return new Uint8Array(16);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/$/, '');
  }

  private generateExecNonce(): string {
    // 12 bytes -> 16 chars base64url-ish, meets backend minimum of 8
    return toBase64Url(randomBytes(12));
  }

  private normalizeCapsulePayload(
    capsule?: Capsule | SerializedCapsule | Record<string, unknown>,
  ): SerializedCapsule | Record<string, unknown> | undefined {
    if (!capsule) {
      return undefined;
    }

    if (capsule instanceof Uint8Array) {
      return undefined;
    }

    if (this.isRawCapsule(capsule)) {
      return serializeCapsule(capsule);
    }

    return capsule as SerializedCapsule | Record<string, unknown>;
  }

  private extractCapsuleId(
    capsule?: SerializedCapsule | Record<string, unknown>,
  ): string | undefined {
    const id = capsule?.id;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }

  private isRawCapsule(
    capsule: Capsule | SerializedCapsule | Record<string, unknown>,
  ): capsule is Capsule {
    return capsule.id instanceof Uint8Array;
  }

  private buildUnsignedFrame(opcode: string, body: any): AxisFrame {
    return {
      v: 1,
      pid: ulid(),
      nonce: toBase64Url(randomBytes(16)),
      ts: Date.now(),
      actorId: this.config.actorId,
      aud: this.config.audience,
      opcode,
      body,
    };
  }

  private async signFrame(frame: AxisFrame): Promise<AxisFrame> {
    if (!this.config.signer) return frame;
    if (!this.config.signerKid) {
      throw new Error('signerKid is required when signer is provided');
    }

    const unsigned: AxisFrame = { ...frame };
    delete (unsigned as any).sig;
    const payload = Buffer.from(canonicalJson(unsigned));
    const signature = await this.config.signer.sign(payload);

    return {
      ...frame,
      sig: {
        alg: 'EdDSA',
        kid: this.config.signerKid,
        value: toBase64Url(signature),
      },
    };
  }

  private async buildJsonFrame(opcode: string, body: any): Promise<AxisFrame> {
    const frame = this.buildUnsignedFrame(opcode, body);
    return this.signFrame(frame);
  }

  private computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}

/** Verify an AXIS JSON frame signature using Ed25519 public key */
export async function verifyAxisFrameSignature(
  frame: AxisFrame,
  publicKey: Uint8Array,
): Promise<boolean> {
  if (!frame.sig || frame.sig.alg !== 'EdDSA' || !frame.sig.value) return false;
  const unsigned: AxisFrame = { ...frame };
  delete (unsigned as any).sig;

  const payload = new TextEncoder().encode(canonicalJson(unsigned));
  const signature = fromBase64Url(frame.sig.value);

  try {
    return await ed.verifyAsync(signature, payload, publicKey);
  } catch {
    return false;
  }
}

export default AxisClient;
