/**
 * AXIS TLV Module Exports
 * Varint-based TLV encoding compatible with axis-backend.
 */

// Core TLV encoding/decoding (re-exported from binary)
export {
  TLV,
  encodeTLVs,
  decodeTLVs,
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
} from './axis-tlv';

// Tag registry (aligned with backend)
export { AXIS_TAG, PROOF_TYPE, FRAME_FLAG } from './axis-tags';
export type { AxisTag, ProofTypeValue } from './axis-tags';

// REST Bridge
export { AxisRestBridge } from './axis-rest-bridge';
export type { RestRequest, AxisBuildOptions } from './axis-rest-bridge';

// Proxy Client
export { AxisProxyClient } from './axis-proxy-client';
export type { RestResponseLike, AxisProxyClientOptions } from './axis-proxy-client';

// Frame signing utilities
export {
  buildSigningRegion,
  buildProofPack,
  signTlvFrame,
  verifyTlvFrameSignature,
  // Deprecated aliases kept for backward compatibility
  signFrame,
  verifyFrameSignature,
  extractProofPack,
} from './axis-capsule-builder';
