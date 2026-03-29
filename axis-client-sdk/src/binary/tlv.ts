/**
 * TLV (Type-Length-Value) encoding/decoding
 * Implements canonical ordering as per AXIS spec
 */

import { encodeVarint, decodeVarint } from './varint';

export interface TLV {
  type: number;
  value: Uint8Array;
}

/**
 * Encode TLVs with canonical ordering (sorted by type ascending)
 * Rejects duplicates by default
 */
export function encodeTLVs(tlvs: TLV[]): Uint8Array {
  // Sort by type (canonical ordering)
  const sorted = [...tlvs].sort((a, b) => a.type - b.type);

  // Check for duplicates
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type === sorted[i - 1].type) {
      throw new Error(`Duplicate TLV type ${sorted[i].type}`);
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (const tlv of sorted) {
    const tType = encodeVarint(tlv.type);
    const tLen = encodeVarint(tlv.value.length);
    
    chunks.push(tType, tLen, tlv.value);
    total += tType.length + tLen.length + tlv.value.length;
  }

  // Concatenate all chunks
  const out = new Uint8Array(total);
  let offset = 0;
  
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}

/**
 * Decode TLVs from bytes
 * Validates canonical ordering and rejects duplicates
 */
export function decodeTLVs(
  bytes: Uint8Array,
  opts?: { maxItems?: number }
): Map<number, Uint8Array> {
  const map = new Map<number, Uint8Array>();
  const maxItems = opts?.maxItems ?? 4096;
  
  let offset = 0;
  let lastType = -1;
  let items = 0;

  while (offset < bytes.length) {
    if (++items > maxItems) {
      throw new Error('Too many TLVs');
    }

    // Decode type
    const t1 = decodeVarint(bytes, offset);
    const type = Number(t1.value);
    offset = t1.offset;

    // Decode length
    const t2 = decodeVarint(bytes, offset);
    const len = Number(t2.value);
    offset = t2.offset;

    // Validate length
    if (len < 0 || offset + len > bytes.length) {
      throw new Error('Bad TLV length');
    }

    // Validate canonical ordering
    if (type <= lastType) {
      throw new Error('TLVs not canonically sorted');
    }
    lastType = type;

    // Check for duplicates
    if (map.has(type)) {
      throw new Error(`Duplicate TLV type ${type}`);
    }

    // Extract value
    const value = bytes.slice(offset, offset + len);
    offset += len;

    map.set(type, value);
  }

  return map;
}

/**
 * Encode a single TLV
 */
export function encodeTLV(type: number, value: Uint8Array): Uint8Array {
  return encodeTLVs([{ type, value }]);
}

/**
 * Helper to encode string as TLV
 */
export function encodeTLVString(type: number, str: string): Uint8Array {
  const value = new TextEncoder().encode(str);
  return encodeTLV(type, value);
}

/**
 * Helper to encode number as TLV
 */
export function encodeTLVNumber(type: number, num: number): Uint8Array {
  const value = encodeVarint(num);
  return encodeTLV(type, value);
}
