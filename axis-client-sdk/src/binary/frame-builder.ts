/**
 * Binary Frame Builder for AXIS MDW-BIN Protocol
 * Constructs binary frames with TLV encoding and canonical ordering
 */

import { TLVType, ProofType, FrameFlags } from './binary-types';
import { encodeTLVs, TLV } from './tlv';
import { encodeVarint } from './varint';
import { buildIntentReference } from '../core/intent-reference';

const MAGIC = new TextEncoder().encode('AXIS1');
const VERSION = 0x01;

export interface AxisFrameInput {
  // Required headers
  pid: Uint8Array; // 16 bytes (UUIDv7)
  ts: bigint; // MEC ticks
  intent: string; // Intent name
  handlerName?: string; // Optional handler namespace/class key
  actorId: Uint8Array; // 16 bytes
  proofType: ProofType;
  proofRef: Uint8Array; // Capsule ID or token
  nonce: Uint8Array; // 16-32 bytes

  // Optional headers
  realm?: string;
  node?: string;
  traceId?: Uint8Array;
  witnessRef?: Uint8Array;
  contractId?: string;
  expectedEffect?: string;

  // Body
  body?: Uint8Array;

  // Flags
  bodyIsTLV?: boolean;
  chainReq?: boolean;
  hasWitness?: boolean;
}

export class AxisFrameBuilder {
  private headers: Map<number, Uint8Array> = new Map();
  private body: Uint8Array = new Uint8Array(0);
  private flags: number = 0;

  /**
   * Set packet ID (required)
   */
  setPid(pid: Uint8Array): this {
    if (pid.length !== 16) {
      throw new Error('PID must be 16 bytes');
    }
    this.headers.set(TLVType.PID, pid);
    return this;
  }

  /**
   * Set timestamp (required)
   */
  setTimestamp(ts: bigint): this {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, ts, false); // Big-endian
    this.headers.set(TLVType.TS, new Uint8Array(buffer));
    return this;
  }

  /**
   * Set intent name (required)
   */
  setIntent(intent: string, handlerName?: string): this {
    const wireIntent = buildIntentReference(intent, handlerName);
    if (wireIntent.length > 128) {
      throw new Error('Intent name too long (max 128 chars)');
    }
    this.headers.set(TLVType.INTENT, new TextEncoder().encode(wireIntent));
    return this;
  }

  /**
   * Set actor ID (required)
   */
  setActorId(actorId: Uint8Array): this {
    if (actorId.length !== 16) {
      throw new Error('ActorId must be 16 bytes');
    }
    this.headers.set(TLVType.ACTOR_ID, actorId);
    return this;
  }

  /**
   * Set proof type (required)
   */
  setProofType(proofType: ProofType): this {
    this.headers.set(TLVType.PROOF_TYPE, new Uint8Array([proofType]));
    return this;
  }

  /**
   * Set proof reference (required)
   */
  setProofRef(proofRef: Uint8Array): this {
    if (proofRef.length === 0 || proofRef.length > 64) {
      throw new Error('ProofRef must be 1-64 bytes');
    }
    this.headers.set(TLVType.PROOF_REF, proofRef);
    return this;
  }

  /**
   * Set nonce (required)
   */
  setNonce(nonce: Uint8Array): this {
    if (nonce.length < 16 || nonce.length > 32) {
      throw new Error('Nonce must be 16-32 bytes');
    }
    this.headers.set(TLVType.NONCE, nonce);
    return this;
  }

  /**
   * Set an extension header.
   */
  setHeader(type: TLVType | number, value: Uint8Array): this {
    this.headers.set(type, value);
    return this;
  }

  /**
   * Set realm (optional)
   */
  setRealm(realm: string): this {
    this.headers.set(TLVType.REALM, new TextEncoder().encode(realm));
    return this;
  }

  /**
   * Set node (optional)
   */
  setNode(node: string): this {
    this.headers.set(TLVType.NODE, new TextEncoder().encode(node));
    return this;
  }

  /**
   * Set trace ID (optional)
   */
  setTraceId(traceId: Uint8Array): this {
    this.headers.set(TLVType.TRACE_ID, traceId);
    return this;
  }

  /**
   * Set body
   */
  setBody(body: Uint8Array): this {
    if (body.length > 65536) {
      throw new Error('Body too large (max 64KB)');
    }
    this.body = body;
    return this;
  }

  /**
   * Set body from JSON object
   * @deprecated [AXIS-BIN] Use setBody(new TextEncoder().encode(JSON.stringify(obj))) instead for explicit binary handling.
   */
  setBodyJSON(obj: any): this {
    console.warn(
      '[AXIS][DEPRECATED] setBodyJSON is deprecated. Use setBody with explicit encoding.',
    );
    const json = JSON.stringify(obj);
    this.body = new TextEncoder().encode(json);
    return this;
  }

  /**
   * Set flags
   */
  setFlags(
    bodyIsTLV: boolean = false,
    chainReq: boolean = false,
    hasWitness: boolean = false,
  ): this {
    this.flags = 0;
    if (bodyIsTLV) this.flags |= FrameFlags.BODY_IS_TLV;
    if (chainReq) this.flags |= FrameFlags.RECEIPT_CHAINING;
    if (hasWitness) this.flags |= FrameFlags.WITNESS_INCLUDED;
    return this;
  }

  /**
   * Get the unsigned frame for signing
   * This is the canonical bytes that get signed
   */
  buildUnsigned(): Uint8Array {
    // Validate required headers
    const required = [
      TLVType.PID,
      TLVType.TS,
      TLVType.INTENT,
      TLVType.ACTOR_ID,
      TLVType.PROOF_TYPE,
      TLVType.PROOF_REF,
      TLVType.NONCE,
    ];

    for (const type of required) {
      if (!this.headers.has(type)) {
        throw new Error(`Missing required header: ${type}`);
      }
    }

    // Convert headers map to TLV array
    const headerTLVs: TLV[] = [];
    for (const [type, value] of this.headers) {
      headerTLVs.push({ type, value });
    }

    // Encode headers with canonical ordering
    const hdrBytes = encodeTLVs(headerTLVs);

    // Encode lengths (with empty signature)
    const hdrLen = encodeVarint(hdrBytes.length);
    const bodyLen = encodeVarint(this.body.length);
    const sigLen = encodeVarint(0); // Empty signature

    // Calculate total size
    const totalSize =
      MAGIC.length + // 5 (AXIS1)
      1 + // VERSION
      1 + // FLAGS
      hdrLen.length +
      bodyLen.length +
      sigLen.length +
      hdrBytes.length +
      this.body.length;

    // Build frame
    const frame = new Uint8Array(totalSize);
    let offset = 0;

    // MAGIC
    frame.set(MAGIC, offset);
    offset += MAGIC.length;

    // VERSION
    frame[offset++] = VERSION;

    // FLAGS
    frame[offset++] = this.flags;

    // HDR_LEN
    frame.set(hdrLen, offset);
    offset += hdrLen.length;

    // BODY_LEN
    frame.set(bodyLen, offset);
    offset += bodyLen.length;

    // SIG_LEN (0 for now)
    frame.set(sigLen, offset);
    offset += sigLen.length;

    // HDR_BYTES
    frame.set(hdrBytes, offset);
    offset += hdrBytes.length;

    // BODY_BYTES
    frame.set(this.body, offset);
    offset += this.body.length;

    return frame;
  }

  /**
   * Build a signed frame with signature
   * @param signature - 64-byte Ed25519 signature
   */
  buildSigned(signature: Uint8Array): Uint8Array {
    if (signature.length !== 64) {
      throw new Error('Signature must be 64 bytes');
    }

    // Validate required headers
    const required = [
      TLVType.PID,
      TLVType.TS,
      TLVType.INTENT,
      TLVType.ACTOR_ID,
      TLVType.PROOF_TYPE,
      TLVType.PROOF_REF,
      TLVType.NONCE,
    ];

    for (const type of required) {
      if (!this.headers.has(type)) {
        throw new Error(`Missing required header: ${type}`);
      }
    }

    // Convert headers map to TLV array
    const headerTLVs: TLV[] = [];
    for (const [type, value] of this.headers) {
      headerTLVs.push({ type, value });
    }

    // Encode headers with canonical ordering
    const hdrBytes = encodeTLVs(headerTLVs);

    // Encode lengths (with actual signature)
    const hdrLen = encodeVarint(hdrBytes.length);
    const bodyLen = encodeVarint(this.body.length);
    const sigLen = encodeVarint(signature.length);

    // Calculate total size
    const totalSize =
      MAGIC.length + // 5 (AXIS1)
      1 + // VERSION
      1 + // FLAGS
      hdrLen.length +
      bodyLen.length +
      sigLen.length +
      hdrBytes.length +
      this.body.length +
      signature.length;

    // Build frame
    const frame = new Uint8Array(totalSize);
    let offset = 0;

    // MAGIC
    frame.set(MAGIC, offset);
    offset += MAGIC.length;

    // VERSION
    frame[offset++] = VERSION;

    // FLAGS
    frame[offset++] = this.flags;

    // HDR_LEN
    frame.set(hdrLen, offset);
    offset += hdrLen.length;

    // BODY_LEN
    frame.set(bodyLen, offset);
    offset += bodyLen.length;

    // SIG_LEN
    frame.set(sigLen, offset);
    offset += sigLen.length;

    // HDR_BYTES
    frame.set(hdrBytes, offset);
    offset += hdrBytes.length;

    // BODY_BYTES
    frame.set(this.body, offset);
    offset += this.body.length;

    // SIGNATURE
    frame.set(signature, offset);
    offset += signature.length;

    return frame;
  }

  /**
   * Build the unsigned frame (for signing or sending without signature)
   * Alias for buildUnsigned() for backward compatibility
   */
  build(): Uint8Array {
    return this.buildUnsigned();
  }

  /**
   * Build frame from input object
   */
  static fromInput(input: AxisFrameInput): Uint8Array {
    const builder = new AxisFrameBuilder()
      .setPid(input.pid)
      .setTimestamp(input.ts)
      .setIntent(input.intent, input.handlerName)
      .setActorId(input.actorId)
      .setProofType(input.proofType)
      .setProofRef(input.proofRef)
      .setNonce(input.nonce);

    // Optional headers
    if (input.realm) builder.setRealm(input.realm);
    if (input.node) builder.setNode(input.node);
    if (input.traceId) builder.setTraceId(input.traceId);

    // Body
    if (input.body) builder.setBody(input.body);

    // Flags
    builder.setFlags(
      input.bodyIsTLV || false,
      input.chainReq || false,
      input.hasWitness || false,
    );

    return builder.build();
  }
}

/**
 * Helper to generate random PID (UUIDv4 for now, should be UUIDv7 in production)
 */
export function generatePid(): Uint8Array {
  const pid = new Uint8Array(16);
  crypto.getRandomValues(pid);
  // Set version 4
  pid[6] = (pid[6] & 0x0f) | 0x40;
  pid[8] = (pid[8] & 0x3f) | 0x80;
  return pid;
}

/**
 * Helper to generate random nonce
 */
export function generateNonce(length: number = 32): Uint8Array {
  if (length < 16 || length > 32) {
    throw new Error('Nonce length must be 16-32 bytes');
  }
  const nonce = new Uint8Array(length);
  crypto.getRandomValues(nonce);
  return nonce;
}

/**
 * Helper to convert UUID string to bytes
 */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert bytes to UUID string
 */
export function bytesToUuid(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new Error('UUID must be 16 bytes');
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.substr(0, 8)}-${hex.substr(8, 4)}-${hex.substr(12, 4)}-${hex.substr(16, 4)}-${hex.substr(20, 12)}`;
}
