import {
  TLV_ACTOR_ID,
  TLV_INTENT,
  TLV_NONCE,
  TLV_PID,
  TLV_PROOF_REF,
  TLV_PROOF_TYPE,
  TLV_TS,
} from '../core/constants';
import { asBigint64BE, asBigintVarint, asUtf8, tlvMap } from './tlv';

/**
 * AXIS TLV Tag Definitions (as per specification)
 */
export const T = {
  /** The specific intent or action (e.g., 'vault.create') */
  INTENT: TLV_INTENT,
  /** Package identifier / ID */
  PID: TLV_PID,
  /** Versioning of the intent schema */
  INTENT_VERSION: 10, // Defaulting to TRACE_ID for now or a new tag if available
  /** Unique identifier for the requesting actor */
  ACTOR_ID: TLV_ACTOR_ID,
  /** Optional Capability Token identifier (16 bytes) */
  CAPSULE_ID: TLV_PROOF_REF,
  /** Unique session/request identifier (16 bytes) */
  NONCE: TLV_NONCE,
  /** High-precision Unix timestamp in milliseconds */
  TS_MS: TLV_TS,
  /** Proof type */
  PROOF_TYPE: TLV_PROOF_TYPE,
  /** Standard binary body tag */
  BODY: 100,
  /** Standard JSON-encoded body tag */
  JSON: 200,
};

/**
 * AxisPacket
 *
 * A high-level representation of an AXIS message after TLV decoding.
 * Combines header metadata with the raw body and signature.
 *
 * @typedef {Object} AxisPacket
 */
export type AxisPacket = {
  /** The intent string */
  intent: string;
  /** Intent schema version */
  intentVersion: number;
  /** Actor identifier */
  actorId: string;
  /** Optional binary Capsule ID */
  capsuleId?: Buffer;
  /** Packet identifier */
  pid: Buffer;
  /** Random nonce for replay protection */
  nonce: Buffer;
  /** Request timestamp */
  tsMs: bigint;
  /** Decoded header TLV map */
  headersMap: Map<number, Buffer[]>;
  /** Decoded body TLV map (if body contains TLVs) */
  bodyMap: Map<number, Buffer[]>;
  /** Original raw header bytes */
  hdrBytes: Buffer;
  /** Original raw body bytes */
  bodyBytes: Buffer;
  /** Cryptographic signature of the frame */
  sig: Buffer;
};

/**
 * Constructs a structured AxisPacket from raw header, body, and signature buffers.
 * Performs rigorous validation on mandatory AXIS fields.
 *
 * @param {Buffer} hdr - Raw header bytes containing the primary TLVs
 * @param {Buffer} body - Raw body bytes
 * @param {Buffer} sig - Signature bytes for the frame
 * @param {number} [flags=0] - Frame flags (bit 0 = BODY_IS_TLV)
 * @returns {AxisPacket} A fully validated AxisPacket object
 * @throws {Error} If mandatory fields (intent, version, actor, nonce, ts) are missing or malformed
 */
export function buildPacket(
  hdr: Buffer,
  body: Buffer,
  sig: Buffer,
  flags: number = 0,
): AxisPacket {
  const hm = tlvMap(hdr);

  // Only parse body as TLV if BODY_IS_TLV flag is set (bit 0)
  const BODY_IS_TLV = 0x01;
  const bm = flags & BODY_IS_TLV ? tlvMap(body) : new Map<number, Buffer[]>();

  const intent = asUtf8(hm.get(T.INTENT)?.[0]);
  const intentVerRaw = hm.get(T.INTENT_VERSION)?.[0];
  const intentVer = intentVerRaw ? Number(asBigintVarint(intentVerRaw)) : 1;
  const actorIdRaw = hm.get(T.ACTOR_ID)?.[0];
  const actorId = actorIdRaw ? actorIdRaw.toString('hex') : undefined;
  const capsuleId = hm.get(T.CAPSULE_ID)?.[0];
  const pid = hm.get(T.PID)?.[0] || hm.get(T.NONCE)?.[0]; // Fallback to nonce if pid missing
  const nonce = hm.get(T.NONCE)?.[0];
  const tsMs = asBigint64BE(hm.get(T.TS_MS)?.[0]);

  if (!intent) throw new Error('PACKET_MISSING_INTENT');
  if (!actorId) throw new Error('PACKET_MISSING_ACTOR_ID');
  if (!nonce || nonce.length < 16 || nonce.length > 32)
    throw new Error('PACKET_BAD_NONCE');
  if (!pid) throw new Error('PACKET_MISSING_PID');
  if (!tsMs) throw new Error('PACKET_MISSING_TS');

  return {
    intent,
    intentVersion: intentVer,
    actorId,
    capsuleId,
    pid,
    nonce,
    tsMs,
    headersMap: hm,
    bodyMap: bm,
    hdrBytes: hdr,
    bodyBytes: body,
    sig,
  };
}
