// Decorators
export { Handler, HANDLER_METADATA_KEY } from "./decorators/handler.decorator";
export {
  Intent,
  INTENT_ROUTES_KEY,
  IntentRoute,
  IntentOptions,
} from "./decorators/intent.decorator";

// Engine
export { IntentRouter, AxisEffect } from "./engine/intent.router";

// Core Protocol
export * from "./core/constants";
export * from "./core/varint";
export * from "./core/tlv";
export * from "./core/signature";
export {
  AxisFrameZ,
  decodeFrame,
  encodeFrame,
  getSignTarget,
} from "./core/axis-bin";
export type { AxisBinaryFrame } from "./core/axis-bin";

// Codec
export * from "./codec/ats1.constants";
export * from "./codec/ats1.passkey.schemas";
export * as Ats1Codec from "./codec/ats1";
export * from "./codec/axis1.encode";
export * from "./codec/axis1.signing";
export * from "./codec/tlv.encode";

// Crypto Utilities
export * from "./crypto/b64url";
export * from "./crypto/canonical-json";
export type {
  AxisAlg,
  CapsuleMode,
  KeyStatus,
  AxisSig,
  AxisPacket,
  AxisCapsuleConstraints,
  AxisCapsulePayload,
} from "./crypto/types";

// Contract Utilities
export * from "./contract/execution-meter";
export * from "./contract/contract.interface";

// Packet and Sensor Types
export { Axis1DecodedFrame, decodeAxis1Frame } from "./types/frame";
export {
  AxisPacket as AxisBinaryPacket,
  T as AxisPacketTags,
  buildPacket,
} from "./types/packet";
export type {
  AxisObservedContext,
  AxisRequestContext,
} from "./types/axis-frame.types";
export type { TLV as AxisTlvType } from "./core/tlv";
export {
  Decision,
  normalizeSensorDecision,
  SensorDecisions,
} from "./sensor/axis-sensor";
export type {
  AxisSensor,
  AxisSensorInit,
  AxisPreSensor,
  AxisPostSensor,
  SensorPhaseMetadata,
  SensorInput,
  SensorDecision,
  SensorMinifiedDecision,
} from "./sensor/axis-sensor";

// Interfaces
export {
  AxisHandler,
  AxisHandlerInit,
} from "./interfaces/axis-handler.interface";
export { AxisCrudHandler } from "./interfaces/axis-crud-handler.interface";

// Security
export * from "./security/scopes";
export * from "./security/capabilities";

// Risk
export * from "./risk/index";

// Core: Opcode Registry
export * from "./core/opcodes";

// Core: Receipt Hash
export * from "./core/receipt";

// Core: Intent Sensitivity
export * from "./core/intent-sensitivity";

// Core: Timeouts
export * from "./core/timeouts";

// Types: Intent Definitions
export type { IntentDefinition } from "./types/intent-definition";

// Frame Validation
export { validateFrameShape, isTimestampValid } from "./core/frame-validator";

// Types: JSON-level Frame Types
export type {
  AxisFrame as AxisJsonFrame,
  AxisResponse as AxisJsonResponse,
  AxisSig as AxisJsonSig,
  AxisAlg as AxisJsonAlg,
} from "./types/axis-frame.types";

// NestFlow - Passwordless QR login, device trust, TickAuth, sessions
export * from "./nestflow";

// Types
