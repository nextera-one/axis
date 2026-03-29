/**
 * AXIS Client SDK - Main Exports
 */

// Core client
export { AxisClient, verifyAxisFrameSignature } from './client/axis-client';
export type {
  AxisClientConfig,
  ProgressCallback,
  ProgressInfo,
  UploadResult,
  IntentResult,
  AxisFrame,
} from './client/axis-client';
export type { AxisFrame as AxisIntentFrame } from './client/axis-client';
export { TypedAxisClient } from './client/typed-intents';

// Binary-transport client (low-level)
export { AxisBinaryClient } from './client/index';
export type { AxisBinaryClientOptions } from './client/index';

// Binary utilities
export * from './binary';

// Signer
export { Ed25519Signer } from './signer';
export type { Signer } from './signer';

// Encoding utilities
export {
  canonicalJson,
  toBase64Url as b64urlEncode,
  fromBase64Url as b64urlDecode,
} from './utils/encoding';

// Re-export from core
export { decodeFrame, encodeFrame } from './core/axis-bin';
export type { AxisBinaryFrame } from './core/axis-bin';
export {
  createCapsule,
  signCapsule,
  verifyCapsule,
  serializeCapsule,
  deserializeCapsule,
  capsuleAllowsIntent,
  isCapsuleExpired,
  hashCapsule,
  generateCapsuleKeyPair,
} from './core/capsule';
export type {
  Capsule,
  SerializedCapsule,
  CapsuleCreateOptions,
} from './core/capsule';

// AXIS TLV (varint-based, backend compatible)
// REST bridge and utilities for converting REST requests to AXIS frames
export {
  AXIS_TAG,
  PROOF_TYPE,
  FRAME_FLAG,
  AxisRestBridge,
  AxisProxyClient,
  signTlvFrame,
  verifyTlvFrameSignature,
  // Deprecated root aliases
  signFrame,
  verifyFrameSignature,
  extractProofPack,
  buildSigningRegion,
  buildProofPack,
  // TLV helpers from tlv module
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
} from './tlv';
export type {
  AxisTag,
  ProofTypeValue,
  RestRequest,
  AxisBuildOptions,
  RestResponseLike,
  AxisProxyClientOptions,
} from './tlv';

// NestFlow - Passwordless QR login, device trust, TickAuth, sessions
export * from './nestflow';
