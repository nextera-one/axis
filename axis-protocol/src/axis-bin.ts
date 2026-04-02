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
 * Represents a structured AXIS frame.
 */
export interface AxisFrame {
  /** Flag bits for protocol control (e.g., encryption, compression) */
  flags: number;
  /** A map of TLV headers where key=Tag and value=BinaryData */
  headers: Map<number, Uint8Array>;
  /** The main payload of the frame */
  body: Uint8Array;
  /** The cryptographic signature covering the frame (except the signature itself) */
  sig: Uint8Array;
}

/** Alias for backward compatibility */
export type AxisBinaryFrame = AxisFrame;

/**
 * Encodes a structured AxisFrame into its binary wire representation.
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

  const hdrLenBytes = encodeVarint(hdrBytes.length);
  const bodyLenBytes = encodeVarint(frame.body.length);
  const sigLenBytes = encodeVarint(frame.sig.length);

  const totalLen =
    5 +
    1 +
    1 +
    hdrLenBytes.length +
    bodyLenBytes.length +
    sigLenBytes.length +
    hdrBytes.length +
    frame.body.length +
    frame.sig.length;

  if (totalLen > MAX_FRAME_LEN) throw new Error('Total frame too large');

  const buf = new Uint8Array(totalLen);
  let offset = 0;

  buf.set(AXIS_MAGIC, offset);
  offset += 5;
  buf[offset++] = AXIS_VERSION;
  buf[offset++] = frame.flags;

  buf.set(hdrLenBytes, offset);
  offset += hdrLenBytes.length;
  buf.set(bodyLenBytes, offset);
  offset += bodyLenBytes.length;
  buf.set(sigLenBytes, offset);
  offset += sigLenBytes.length;

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

  if (offset + 5 > buf.length) throw new Error('Packet too short');
  for (let i = 0; i < 5; i++) {
    if (buf[offset + i] !== AXIS_MAGIC[i]) throw new Error('Invalid Magic');
  }
  offset += 5;

  const ver = buf[offset++];
  if (ver !== AXIS_VERSION) throw new Error(`Unsupported version: ${ver}`);

  const flags = buf[offset++];

  const { value: hdrLen, length: hlLen } = decodeVarint(buf, offset);
  offset += hlLen;
  if (hdrLen > MAX_HDR_LEN) throw new Error('Header limit exceeded');

  const { value: bodyLen, length: blLen } = decodeVarint(buf, offset);
  offset += blLen;
  if (bodyLen > MAX_BODY_LEN) throw new Error('Body limit exceeded');

  const { value: sigLen, length: slLen } = decodeVarint(buf, offset);
  offset += slLen;
  if (sigLen > MAX_SIG_LEN) throw new Error('Signature limit exceeded');

  if (offset + hdrLen + bodyLen + sigLen > buf.length) {
    throw new Error('Frame truncated');
  }

  const hdrBytes = buf.slice(offset, offset + hdrLen);
  offset += hdrLen;
  const bodyBytes = buf.slice(offset, offset + bodyLen);
  offset += bodyLen;
  const sigBytes = buf.slice(offset, offset + sigLen);
  offset += sigLen;

  const headers = decodeTLVs(hdrBytes);
  return { flags, headers, body: bodyBytes, sig: sigBytes };
}

/**
 * Helper to get canonical bytes for signing.
 * Returns the frame re-encoded with an empty signature field.
 */
export function getSignTarget(frame: AxisFrame): Uint8Array {
  return encodeFrame({ ...frame, sig: new Uint8Array(0) });
}
