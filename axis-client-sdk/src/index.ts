/**
 * AXIS Client SDK - Main Exports
 */

// Core client
export { AxisClient, verifyAxisFrameSignature } from "./client/axis-client";
export type {
  AxisClientConfig,
  ProgressCallback,
  ProgressInfo,
  UploadResult,
  IntentResult,
  AxisFrame,
} from "./client/axis-client";
export type { AxisFrame as AxisIntentFrame } from "./client/axis-client";
export { TypedAxisClient } from "./client/typed-intents";

// Binary-transport client (low-level)
export { AxisBinaryClient } from "./client/index";
export type { AxisBinaryClientOptions } from "./client/index";

// Binary utilities
export * from "./binary";

// Signer
export {
  Ed25519Signer,
  P256Signer,
  ed25519PublicKeyToSpki,
  exportSignerPublicKeySpki,
  exportSignerPublicKeySpkiBase64Url,
  generateP256KeyPair,
} from "./signer";
export type {
  P256KeyPair,
  P256PrivateKeyInput,
  P256SignerOptions,
  Signer,
} from "./signer";

// QR auth compatibility helpers
export * from "./qr-auth";

// Intent chains
export {
  buildChainStep,
  buildIntentChain,
  buildIntentEnvelope,
} from "./chain/intent-chain";
export {
  decodeChainEnvelope,
  decodeChainRequest,
  encodeChainEnvelope,
  encodeChainRequest,
} from "./chain/binary-chain";
export type {
  AxisCapsuleRef,
  AxisChainEnvelope,
  AxisChainEncryption,
  AxisChainRequest,
  AxisChainResult,
  AxisChainStatus,
  AxisChainStep,
  AxisChainStepResult,
  AxisChainStepStatus,
  AxisExecutionMode,
  AxisIntentEnvelope,
  AxisKeyExchangeRef,
  AxisObserverEvent,
  BuildIntentChainOptions,
  BuildIntentEnvelopeOptions,
} from "./chain/intent-chain";

// Encoding utilities
export {
  canonicalJson,
  toBase64Url as b64urlEncode,
  fromBase64Url as b64urlDecode,
} from "./utils/encoding";

// Re-export from core
export { decodeFrame, encodeFrame } from "./core/axis-bin";
export type { AxisBinaryFrame } from "./core/axis-bin";
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
} from "./core/capsule";
export type {
  Capsule,
  SerializedCapsule,
  CapsuleCreateOptions,
} from "./core/capsule";

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
} from "./tlv";
export type {
  AxisTag,
  ProofTypeValue,
  RestRequest,
  AxisBuildOptions,
  RestResponseLike,
  AxisProxyClientOptions,
} from "./tlv";

// TLV DTO helpers
export { AxisTlvDto } from "./base/axis-tlv.dto";
export {
  TlvEnum,
  TlvField,
  TlvMinLen,
  TlvRange,
  TlvUtf8Pattern,
  TlvValidate,
} from "./decorators/tlv-field.decorator";

// Copied backend client contracts
export * from "./auth/axis-auth-qr.dto";
export * from "./catalog/intent-catalog";
export * from "./model/data_object";
export * from "./payments/payments-axis.dto";
export * from "./axis";

// CCE — Capsule-Carried Encryption (Client)
export * from "./cce";

// Ensure reflect metadata is initialized when the SDK is loaded.
import "reflect-metadata";
