import { decVarint } from './tlv';

/**
 * Axis1DecodedFrame
 *
 * Represents a parsed AXIS v1 binary frame.
 *
 * @typedef {Object} Axis1DecodedFrame
 */
export type Axis1DecodedFrame = {
  /** Protocol version (should be 1) */
  ver: number;
  /** Frame flags for protocol extensions */
  flags: number;
  /** Raw header bytes (containing primary TLVs) */
  hdr: Buffer;
  /** Raw body bytes (the main payload) */
  body: Buffer;
  /** Cryptographic signature bytes */
  sig: Buffer;
  /** Total original size of the frame in bytes */
  frameSize: number;
};

const MAGIC = Buffer.from('AXIS1', 'ascii');

/**
 * Decodes a raw binary buffer into a structured Axis1DecodedFrame.
 * Implements the AXIS v1 wire format specification.
 *
 * **Binary Structure (canonical):**
 * 1. Magic: 'AXIS1' (5 bytes)
 * 2. Version: (1 byte)
 * 3. Flags: (1 byte)
 * 4. HDR_LEN: Varint
 * 5. BODY_LEN: Varint
 * 6. SIG_LEN: Varint
 * 7. HDR: (HDR_LEN bytes)
 * 8. BODY: (BODY_LEN bytes)
 * 9. SIG: (SIG_LEN bytes)
 *
 * @param {Buffer} buf - Raw bytes from the wire
 * @returns {Axis1DecodedFrame} Parsed frame object
 * @throws {Error} If magic is invalid, frame is truncated, or lengths are inconsistent
 */
export function decodeAxis1Frame(buf: Buffer): Axis1DecodedFrame {
  let off = 0;

  const magic = buf.subarray(off, off + 5);
  off += 5;
  if (magic.length !== 5 || !magic.equals(MAGIC))
    throw new Error('AXIS1_BAD_MAGIC');

  if (off + 2 > buf.length) throw new Error('AXIS1_TRUNCATED');
  const ver = buf[off++];
  const flags = buf[off++];

  // Read all three lengths first (canonical order: hdrLen, bodyLen, sigLen)
  const h1 = decVarint(buf, off);
  off = h1.off;
  const b1 = decVarint(buf, off);
  off = b1.off;
  const s1 = decVarint(buf, off);
  off = s1.off;

  const hdrLen = Number(h1.val);
  const bodyLen = Number(b1.val);
  const sigLen = Number(s1.val);

  if (hdrLen < 0 || bodyLen < 0 || sigLen < 0) throw new Error('AXIS1_LEN_NEG');

  if (off + hdrLen + bodyLen + sigLen > buf.length)
    throw new Error('AXIS1_TRUNCATED_PAYLOAD');

  // Then read payloads in order: HDR, BODY, SIG
  const hdr = buf.subarray(off, off + hdrLen);
  off += hdrLen;
  const body = buf.subarray(off, off + bodyLen);
  off += bodyLen;
  const sig = buf.subarray(off, off + sigLen);
  off += sigLen;

  if (off !== buf.length) throw new Error('AXIS1_TRAILING_BYTES');

  return { ver, flags, hdr, body, sig, frameSize: buf.length };
}
