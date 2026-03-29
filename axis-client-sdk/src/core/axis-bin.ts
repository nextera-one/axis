import {
  AXIS_MAGIC,
  AXIS_VERSION,
  MAX_BODY_LEN,
  MAX_FRAME_LEN,
  MAX_HDR_LEN,
  MAX_SIG_LEN,
} from './constants';
import { decodeTLVs, encodeTLVs, TLV } from './tlv';
import { decodeVarint, encodeVarint } from './varint';

export interface AxisBinaryFrame {
  flags: number;
  headers: Map<number, Uint8Array>;
  body: Uint8Array;
  sig: Uint8Array;
}

export type AxisFrame = AxisBinaryFrame;

/**
 * Encodes a full AXIS Frame.
 */
export function encodeFrame(frame: AxisBinaryFrame): Uint8Array {
  const hdrBytes = encodeTLVs(
    Array.from(frame.headers.entries()).map(([t, v]) => ({ type: t, value: v }))
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

  // Magic
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
 * Decodes a full AXIS Frame (strict validation).
 */
export function decodeFrame(buf: Uint8Array): AxisBinaryFrame {
  let offset = 0;

  // 1. Magic
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
export function getSignTarget(frame: AxisBinaryFrame): Uint8Array {
  // Re-encode frame but with empty signature
  // Note: This is efficient enough for v1 (tens of KB).
  return encodeFrame({
    ...frame,
    sig: new Uint8Array(0),
  });
}
