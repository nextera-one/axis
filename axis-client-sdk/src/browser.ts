/**
 * AXIS Client SDK — Browser-safe exports
 *
 * This entry point excludes modules that depend on Node.js built-ins
 * (crypto, fs, path) and is safe for Vite / browser bundlers.
 */

// Binary utilities (frame builder, TLV, varint) — all browser-safe
export * from './binary';
export * from './core/intent-reference';

// TLV tag registry and encoding — browser-safe
export {
  AXIS_TAG,
  PROOF_TYPE,
  FRAME_FLAG,
  pack,
  unpack,
  getOne,
  tlvString,
  tlvU8,
  tlvU16,
  tlvU32,
  tlvU64,
  tlvVarint,
  tlvBytes,
  readString,
  readU8,
  readU16,
  readU32,
  readU64,
  TLV,
  encodeTLVs,
  decodeTLVs,
} from './tlv';
export type { AxisTag, ProofTypeValue } from './tlv';

// Encoding utilities (canonical JSON) — browser-safe subset
export { canonicalJson } from './utils/encoding';
