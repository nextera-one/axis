/**
 * Encodes a number (up to 53 bits safe integer) into a Varint buffer.
 */
export function encodeVarint(value: number): Uint8Array {
  if (value < 0) throw new Error('Varint must be unsigned');
  const bytes: number[] = [];
  while (true) {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value === 0) {
      bytes.push(byte);
      break;
    }
    bytes.push(byte | 0x80);
  }
  return new Uint8Array(bytes);
}

/**
 * Decodes a Varint from a buffer starting at offset.
 * Returns { value, length }.
 */
export function decodeVarint(buf: Uint8Array, offset = 0): { value: number; length: number } {
  let value = 0;
  let shift = 0;
  let length = 0;

  while (true) {
    if (offset + length >= buf.length) {
      throw new Error('Varint decode out of bounds');
    }
    const byte = buf[offset + length];
    value += (byte & 0x7f) * Math.pow(2, shift);
    length++;
    shift += 7;
    if ((byte & 0x80) === 0) {
      break;
    }
    if (length > 8) throw new Error('Varint too large');
  }

  return { value, length };
}

/**
 * Helper to calculate byte length of a varint without allocating.
 */
export function varintLength(value: number): number {
  if (value < 0) throw new Error('Varint must be unsigned');
  let len = 0;
  do {
    value >>>= 7;
    len++;
  } while (value !== 0);
  return len;
}
