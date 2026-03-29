import { encodeVarint, decodeVarint, varintLength } from './varint';

export interface TLV {
  type: number;
  value: Uint8Array;
}

/**
 * Encodes a list of TLVs into a canonical byte buffer.
 * Rules:
 * 1. Sort by TYPE ascending.
 * 2. Encode TYPE (varint) + LEN (varint) + VALUE.
 */
export function encodeTLVs(tlvs: TLV[]): Uint8Array {
  // 1. Sort by TYPE ascending
  // Create a copy to avoid mutating input
  const sorted = [...tlvs].sort((a, b) => a.type - b.type);

  // 2. Check for duplicates
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].type === sorted[i + 1].type) {
      throw new Error(`Duplicate TLV type: ${sorted[i].type}`);
    }
  }

  // 3. Calculate total size
  let totalSize = 0;
  for (const t of sorted) {
    totalSize += varintLength(t.type);
    totalSize += varintLength(t.value.length);
    totalSize += t.value.length;
  }

  // 4. Encode
  const buf = new Uint8Array(totalSize);
  let offset = 0;
  for (const t of sorted) {
    const typeBytes = encodeVarint(t.type);
    buf.set(typeBytes, offset);
    offset += typeBytes.length;

    const lenBytes = encodeVarint(t.value.length);
    buf.set(lenBytes, offset);
    offset += lenBytes.length;

    buf.set(t.value, offset);
    offset += t.value.length;
  }

  return buf;
}

/**
 * Decodes a buffer of TLVs.
 * Enforces canonical order (strict mode).
 */
export function decodeTLVs(buf: Uint8Array): Map<number, Uint8Array> {
  const map = new Map<number, Uint8Array>();
  let offset = 0;
  let lastType = -1;

  while (offset < buf.length) {
    // Decode TYPE
    const { value: type, length: typeLen } = decodeVarint(buf, offset);
    offset += typeLen;

    // Check canonical order
    if (type <= lastType) {
      throw new Error(`TLV violation: Unsorted or duplicate type ${type} after ${lastType}`);
    }
    lastType = type;

    // Decode LEN
    const { value: len, length: lenLen } = decodeVarint(buf, offset);
    offset += lenLen;

    // Check bounds
    if (offset + len > buf.length) {
      throw new Error(`TLV violation: Length ${len} exceeds buffer`);
    }

    // Extract VALUE
    const value = buf.slice(offset, offset + len);
    map.set(type, value);
    offset += len;
  }

  return map;
}

/**
 * Decodes a binary buffer of TLVs into a flat list.
 * Preserves the original wire order and allows duplicate types.
 */
export function decodeTLVsList(buf: Uint8Array, maxItems = 1024): TLV[] {
  const list: TLV[] = [];
  let offset = 0;

  while (offset < buf.length) {
    if (list.length >= maxItems) throw new Error('TLV_LIMIT');

    const { value: type, length: typeLen } = decodeVarint(buf, offset);
    offset += typeLen;

    const { value: len, length: lenLen } = decodeVarint(buf, offset);
    offset += lenLen;

    if (offset + len > buf.length) {
      throw new Error(`TLV violation: Length ${len} exceeds buffer`);
    }

    const value = buf.slice(offset, offset + len);
    list.push({ type, value });
    offset += len;
  }

  return list;
}

export function decodeObject(
  bytes: Uint8Array,
  depth = 0,
  limits = { maxDepth: 8, maxItems: 128 },
): Map<number, unknown> {
  if (depth > limits.maxDepth) {
    throw new Error('OBJECT_DEPTH_EXCEEDED');
  }

  return decodeTLVs(bytes);
}

export function decodeArray(
  bytes: Uint8Array,
  itemType: number,
  maxItems = 256,
): Uint8Array[] {
  const list = decodeTLVsList(bytes, maxItems);
  const items: Uint8Array[] = [];

  for (const tlv of list) {
    if (tlv.type !== itemType) {
      throw new Error(`INVALID_ARRAY_ITEM:${tlv.type}`);
    }
    items.push(tlv.value);
  }

  return items;
}
