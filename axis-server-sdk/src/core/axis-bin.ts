import * as z from 'zod';

/**
 * AxisFrame Schema
 *
 * Defines the logical structure of an AXIS frame using Zod for runtime validation.
 * This is used for internal processing after the low-level binary parsing is complete.
 */
export const AxisFrameZ = z.object({
  /** Flag bits for protocol control (e.g., encryption, compression) */
  flags: z.number().int().nonnegative(),
  /** A map of TLV headers where key=Tag and value=BinaryData */
  headers: z.map(
    z.number(),
    z.custom<Uint8Array>((v) => v instanceof Uint8Array),
  ),
  /** The main payload of the frame */
  body: z.custom<Uint8Array>((v) => v instanceof Uint8Array),
  /** The cryptographic signature covering the frame (except the signature itself) */
  sig: z.custom<Uint8Array>((v) => v instanceof Uint8Array),
});

/**
 * Represents a structured AXIS frame.
 * @typedef {Object} AxisFrame
 */
export type AxisFrame = z.infer<typeof AxisFrameZ>;
export type AxisBinaryFrame = AxisFrame;
import {
  AXIS_MAGIC,
  AXIS_VERSION,
  MAX_BODY_LEN,
  MAX_FRAME_LEN,
  MAX_HDR_LEN,
  MAX_SIG_LEN,
} from './constants';
import { decodeTLVs, encodeTLVs } from './tlv';
import { decodeVarint, encodeVarint } from './varint';

/**
 * Encodes a structured AxisFrame into its binary wire representation.
 *
 * **Encoding Steps:**
 * 1. Encodes header TLV map into a single buffer.
 * 2. Validates lengths against MAX_* constants.
 * 3. Encodes lengths (HDR, BODY, SIG) as varints.
 * 4. Assembles the final byte array with magic, version, and flags.
 *
 * @param {AxisFrame} frame - The structured frame to encode
 * @returns {Uint8Array} The full binary frame
 * @throws {Error} If any section exceeds protocol limits
 */
export function encodeFrame(frame: AxisFrame): Uint8Array {
  const hdrBytes = encodeTLVs(
    Array.from(frame.headers.entries()).map(([t, v]) => ({
      type: t,
      value: v,
    })),
  );

  if (hdrBytes.length > MAX_HDR_LEN) throw new Error('Header too large');
  if (frame.body.length > MAX_BODY_LEN) throw new Error('Body too large');
  if (frame.sig.length > MAX_SIG_LEN) throw new Error('Signature too large');

  // Header Len, Body Len, Sig Len
  const hdrLenBytes = encodeVarint(hdrBytes.length);
  const bodyLenBytes = encodeVarint(frame.body.length);
  const sigLenBytes = encodeVarint(frame.sig.length);

  const totalLen =
    5 + // Magic (AXIS1)
    1 + // Version
    1 + // Flags
    hdrLenBytes.length +
    bodyLenBytes.length +
    sigLenBytes.length +
    hdrBytes.length +
    frame.body.length +
    frame.sig.length;

  if (totalLen > MAX_FRAME_LEN) throw new Error('Total frame too large');

  const buf = new Uint8Array(totalLen);
  let offset = 0;

  // Magic (AXIS1 - 5 bytes)
  buf.set(AXIS_MAGIC, offset);
  offset += 5;

  // Version
  buf[offset++] = AXIS_VERSION;

  // Flags
  buf[offset++] = frame.flags;

  // Lengths
  buf.set(hdrLenBytes, offset);
  offset += hdrLenBytes.length;

  buf.set(bodyLenBytes, offset);
  offset += bodyLenBytes.length;

  buf.set(sigLenBytes, offset);
  offset += sigLenBytes.length;

  // Payloads
  buf.set(hdrBytes, offset);
  offset += hdrBytes.length;

  buf.set(frame.body, offset);
  offset += frame.body.length;

  buf.set(frame.sig, offset);
  offset += frame.sig.length;

  return buf;
}

/**
 * Decodes a binary buffer into a structured AxisFrame with strict validation.
 *
 * @param {Uint8Array} buf - Raw bytes from the wire
 * @returns {AxisFrame} The parsed and validated frame
 * @throws {Error} If magic, version, or lengths are invalid
 */
export function decodeFrame(buf: Uint8Array): AxisFrame {
  let offset = 0;

  // 1. Magic (AXIS1 - 5 bytes)
  if (offset + 5 > buf.length) throw new Error('Packet too short');
  for (let i = 0; i < 5; i++) {
    if (buf[offset + i] !== AXIS_MAGIC[i]) throw new Error('Invalid Magic');
  }
  offset += 5;

  // 2. Version
  const ver = buf[offset++];
  if (ver !== AXIS_VERSION) throw new Error(`Unsupported version: ${ver}`);

  // 3. Flags
  const flags = buf[offset++];

  // 4. Lengths
  const { value: hdrLen, length: hlLen } = decodeVarint(buf, offset);
  offset += hlLen;
  if (hdrLen > MAX_HDR_LEN) throw new Error('Header limit exceeded');

  const { value: bodyLen, length: blLen } = decodeVarint(buf, offset);
  offset += blLen;
  if (bodyLen > MAX_BODY_LEN) throw new Error('Body limit exceeded');

  const { value: sigLen, length: slLen } = decodeVarint(buf, offset);
  offset += slLen;
  if (sigLen > MAX_SIG_LEN) throw new Error('Signature limit exceeded');

  // 5. Extract Bytes
  if (offset + hdrLen + bodyLen + sigLen > buf.length) {
    throw new Error('Frame truncated');
  }

  const hdrBytes = buf.slice(offset, offset + hdrLen);
  offset += hdrLen;

  const bodyBytes = buf.slice(offset, offset + bodyLen);
  offset += bodyLen;

  const sigBytes = buf.slice(offset, offset + sigLen);
  offset += sigLen;

  // 6. Decode Header TLVs
  const headers = decodeTLVs(hdrBytes);

  return {
    flags,
    headers,
    body: bodyBytes,
    sig: sigBytes,
  };
}

/**
 * Helper to get canonical bytes for signing.
 * SigTarget = All bytes up to SigLen, with SigLen=0, and no SigBytes.
 */
export function getSignTarget(frame: AxisFrame): Uint8Array {
  // Re-encode frame but with empty signature
  // Note: This is efficient enough for v1 (tens of KB).
  return encodeFrame({
    ...frame,
    sig: new Uint8Array(0),
  });
}
