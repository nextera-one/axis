// tlv.encode.ts
import { randomBytes } from 'crypto';

export function encVarint(x: bigint): Buffer {
  if (x < 0n) throw new Error('VARINT_NEG');
  const out: number[] = [];
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n));
    x >>= 7n;
  }
  out.push(Number(x));
  return Buffer.from(out);
}

export function varintU(x: number | bigint): Buffer {
  const v = typeof x === 'number' ? BigInt(x) : x;
  return encVarint(v);
}

export function u64be(x: bigint): Buffer {
  if (x < 0n) throw new Error('U64_NEG');
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(x, 0);
  return b;
}

export function utf8(s: string): Buffer {
  return Buffer.from(s, 'utf8');
}

export function bytes(b: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(b) ? b : Buffer.from(b);
}

export function nonce16(): Buffer {
  return randomBytes(16);
}

export function tlv(type: number, value: Buffer): Buffer {
  if (!Number.isSafeInteger(type) || type < 0) throw new Error('TLV_BAD_TYPE');
  return Buffer.concat([
    encVarint(BigInt(type)),
    encVarint(BigInt(value.length)),
    value,
  ]);
}

/**
 * Canonical TLV encoding:
 * - sorted by type ascending
 * - no duplicates by default
 */
export function buildTLVs(
  items: { type: number; value: Buffer }[],
  opts?: { allowDupTypes?: Set<number> },
): Buffer {
  const allow = opts?.allowDupTypes ?? new Set<number>();
  const sorted = [...items].sort((a, b) => a.type - b.type);

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type === sorted[i - 1].type && !allow.has(sorted[i].type)) {
      throw new Error(`TLV_DUP_TYPE_${sorted[i].type}`);
    }
  }

  return Buffer.concat(sorted.map((it) => tlv(it.type, it.value)));
}
