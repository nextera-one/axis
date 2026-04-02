/**
 * Encodes a number (up to 53 bits safe integer) into a Varint buffer.
 * Varints are a way of encoding integers using one or more bytes.
 * Smaller numbers take fewer bytes.
 *
 * @param {number} value - The unsigned integer to encode
 * @returns {Uint8Array} The encoded binary buffer
 * @throws {Error} If the value is negative
 */
export function encodeVarint(value: number): Uint8Array {
  if (value < 0) throw new Error('Varint must be unsigned');
  const bytes: number[] = [];
  while (true) {
    const byte = value & 0x7f;
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
 * Decodes a Varint from a buffer starting at a specific offset.
 *
 * @param {Uint8Array} buf - The buffer containing the encoded varint
 * @param {number} [offset=0] - The starting position in the buffer
 * @returns {Object} The decoded numeric value and the number of bytes consumed (length)
 * @throws {Error} If the buffer is too small or the varint exceeds 8 bytes (max 53-bit safe int)
 */
export function decodeVarint(
  buf: Uint8Array,
  offset = 0,
): { value: number; length: number } {
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
 * Calculates the number of bytes required to encode a value as a varint.
 * Useful for pre-allocating buffers.
 *
 * @param {number} value - The unsigned integer to check
 * @returns {number} The byte length
 * @throws {Error} If the value is negative
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
