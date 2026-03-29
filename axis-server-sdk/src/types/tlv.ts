/**
 * Decodes a variable-length integer (Varint) from a buffer.
 * Supports up to 64-bit integers.
 *
 * @param {Buffer} buf - The buffer to read from
 * @param {number} off - The offset to start reading from
 * @returns {Object} The decoded bigint value and the new offset
 * @throws {Error} If the varint is malformed or exceeds 64 bits
 */
export function decVarint(
  buf: Buffer,
  off: number,
): { val: bigint; off: number } {
  let shift = 0n;
  let x = 0n;
  while (true) {
    if (off >= buf.length) throw new Error('varint overflow');
    const b = BigInt(buf[off++]);
    x |= (b & 0x7fn) << shift;
    if ((b & 0x80n) === 0n) break;
    shift += 7n;
    if (shift > 63n) throw new Error('varint too large');
  }
  return { val: x, off };
}

import type { TLV } from '../core/tlv';

/**
 * Parses a buffer into an array of TLV objects.
 *
 * @param {Buffer} buf - The buffer containing TLV-encoded data
 * @param {number} [maxItems=512] - Security limit for the number of TLVs to parse
 * @returns {TLV[]} An array of parsed TLVs
 * @throws {Error} If TLV structure is invalid or limits are exceeded
 */
export function parseTLVs(buf: Buffer, maxItems: number = 512): TLV[] {
  const out: TLV[] = [];
  let off = 0;
  while (off < buf.length) {
    if (out.length >= maxItems) throw new Error('TLV_TOO_MANY_ITEMS');
    const t1 = decVarint(buf, off);
    off = t1.off;
    const t2 = decVarint(buf, off);
    off = t2.off;
    const type = Number(t1.val);
    const len = Number(t2.val);
    if (len < 0 || off + len > buf.length) {
      throw new Error('TLV_LEN_INVALID');
    }
    const value = buf.subarray(off, off + len);
    off += len;
    out.push({ type, value });
  }
  return out;
}

/**
 * Parses TLVs and organizes them into a Map for efficient access.
 * Multiple values for the same type are preserved in an array.
 *
 * @param {Buffer} buf - The raw TLV-encoded buffer
 * @returns {Map<number, Buffer[]>} A map of Tag -> [Values]
 */
export function tlvMap(buf: Buffer): Map<number, Buffer[]> {
  const m = new Map<number, Buffer[]>();
  for (const it of parseTLVs(buf)) {
    const arr = m.get(it.type) ?? [];
    arr.push(it.value as Buffer);
    m.set(it.type, arr);
  }
  return m;
}

export function asUtf8(b?: Buffer): string | undefined {
  if (!b) return undefined;
  return b.toString('utf8');
}

export function asBigintVarint(b?: Buffer): bigint | undefined {
  if (!b) return undefined;
  const { val, off } = decVarint(b, 0);
  if (off !== b.length) throw new Error('VARINT_TRAILING_BYTES');
  return val;
}

/**
 * Parses an 8-byte big-endian buffer as a BigInt.
 * Used for timestamps which are sent as fixed 8-byte u64.
 */
export function asBigint64BE(b?: Buffer): bigint | undefined {
  if (!b) return undefined;
  if (b.length !== 8) throw new Error('Expected 8 bytes for u64');
  return b.readBigUInt64BE(0);
}

export function encVarint(x: bigint): Buffer {
  if (x < 0n) throw new Error('varint neg');
  const out: number[] = [];
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n));
    x >>= 7n;
  }
  out.push(Number(x));
  return Buffer.from(out);
}

export function tlv(type: number, value: Buffer): Buffer {
  return Buffer.concat([
    encVarint(BigInt(type)),
    encVarint(BigInt(value.length)),
    value,
  ]);
}

export function buildTLVs(items: { type: number; value: Buffer }[]): Buffer {
  // Canonical: sort by type ascending
  const sorted = [...items].sort((a, b) => a.type - b.type);

  // Canonical: forbid duplicate tags by default
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type === sorted[i - 1].type) {
      throw new Error(`TLV_DUP_TYPE_${sorted[i].type}`);
    }
  }

  return Buffer.concat(sorted.map((it) => tlv(it.type, it.value)));
}

export function u64be(x: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(x);
  return b;
}

export function utf8(s: string): Buffer {
  return Buffer.from(s, 'utf8');
}

export function varintU(x: number | bigint): Buffer {
  const v = typeof x === 'number' ? BigInt(x) : x;
  return encVarint(v);
}
