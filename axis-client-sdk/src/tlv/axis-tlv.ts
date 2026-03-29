/**
 * AXIS TLV Encoding/Decoding
 * Uses VARINT encoding (same as backend) for compatibility.
 * Format: [type_varint][len_varint][value_bytes]
 *
 * Re-exports and extends the existing binary/tlv.ts for REST bridge use cases.
 */

// Re-export the core varint-based TLV functions from binary module
export { encodeTLVs, decodeTLVs } from '../binary/tlv';
export type { TLV } from '../binary/tlv';

import { encodeTLVs, decodeTLVs, TLV } from '../binary/tlv';
import { encodeVarint } from '../binary/varint';

const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * Create a nested pack TLV (stores encoded TLVs as its value).
 */
export function pack(type: number, inner: TLV[]): TLV {
  return { type, value: encodeTLVs(inner) };
}

/**
 * Unpack a nested pack TLV (decode inner TLVs from value).
 * Returns Map for compatibility with existing decodeTLVs.
 */
export function unpack(packValue: Uint8Array): Map<number, Uint8Array> {
  return decodeTLVs(packValue);
}

/**
 * Get value from TLV Map by type.
 */
export function getOne(
  tlvs: Map<number, Uint8Array>,
  type: number
): Uint8Array | undefined {
  return tlvs.get(type);
}

/**
 * Create a TLV with string value (UTF-8 encoded).
 */
export function tlvString(type: number, str: string): TLV {
  return { type, value: enc.encode(str) };
}

/**
 * Create a TLV with uint8 value.
 */
export function tlvU8(type: number, val: number): TLV {
  return { type, value: new Uint8Array([val & 0xff]) };
}

/**
 * Create a TLV with uint16 BE value.
 */
export function tlvU16(type: number, val: number): TLV {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, val, false);
  return { type, value: buf };
}

/**
 * Create a TLV with uint32 BE value.
 */
export function tlvU32(type: number, val: number): TLV {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, val, false);
  return { type, value: buf };
}

/**
 * Create a TLV with uint64 BE value.
 */
export function tlvU64(type: number, val: bigint): TLV {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, val, false);
  return { type, value: buf };
}

/**
 * Create a TLV with varint value.
 */
export function tlvVarint(type: number, val: number): TLV {
  return { type, value: encodeVarint(val) };
}

/**
 * Create a TLV with raw bytes.
 */
export function tlvBytes(type: number, bytes: Uint8Array): TLV {
  return { type, value: bytes };
}

/**
 * Read string from TLV value.
 */
export function readString(value: Uint8Array | undefined): string {
  if (!value) return '';
  return dec.decode(value);
}

/**
 * Read uint8 from TLV value.
 */
export function readU8(value: Uint8Array | undefined): number {
  if (!value || value.length < 1) return 0;
  return value[0];
}

/**
 * Read uint16 BE from TLV value.
 */
export function readU16(value: Uint8Array | undefined): number {
  if (!value || value.length < 2) return 0;
  return new DataView(value.buffer, value.byteOffset, value.byteLength).getUint16(0, false);
}

/**
 * Read uint32 BE from TLV value.
 */
export function readU32(value: Uint8Array | undefined): number {
  if (!value || value.length < 4) return 0;
  return new DataView(value.buffer, value.byteOffset, value.byteLength).getUint32(0, false);
}

/**
 * Read uint64 BE from TLV value.
 */
export function readU64(value: Uint8Array | undefined): bigint {
  if (!value || value.length < 8) return 0n;
  return new DataView(value.buffer, value.byteOffset, value.byteLength).getBigUint64(0, false);
}
