/**
 * Varint encoding/decoding (LEB128 unsigned)
 * Used for TLV type and length encoding
 */

/**
 * Encode an unsigned integer as varint (LEB128)
 */
export function encodeVarint(n: number | bigint): Uint8Array {
  let x = typeof n === 'bigint' ? n : BigInt(n);
  
  if (x < 0n) {
    throw new Error('Varint must be unsigned (non-negative)');
  }

  const out: number[] = [];
  
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n));
    x >>= 7n;
  }
  
  out.push(Number(x));
  
  return Uint8Array.from(out);
}

/**
 * Decode a varint from a buffer
 * Returns the decoded value and the new offset
 */
export function decodeVarint(buf: Uint8Array, offset = 0): { value: bigint; offset: number } {
  let x = 0n;
  let shift = 0n;
  let i = offset;

  for (; i < buf.length; i++) {
    const b = BigInt(buf[i]);
    x |= (b & 0x7fn) << shift;
    
    if ((b & 0x80n) === 0n) {
      return { value: x, offset: i + 1 };
    }
    
    shift += 7n;
    
    if (shift > 63n) {
      throw new Error('Varint too large (exceeds 64 bits)');
    }
  }

  throw new Error('Truncated varint');
}
