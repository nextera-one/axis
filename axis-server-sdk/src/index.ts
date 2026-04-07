// Decorators
export { Handler, HANDLER_METADATA_KEY } from "./decorators/handler.decorator";
export {
  Intent,
  INTENT_METADATA_KEY,
  INTENT_ROUTES_KEY,
  IntentRoute,
  IntentOptions,
  IntentTlvField,
  IntentKind,
} from "./decorators/intent.decorator";
export {
  IntentBody,
  INTENT_BODY_KEY,
} from "./decorators/intent-body.decorator";
export {
  IntentSensors,
  INTENT_SENSORS_KEY,
} from "./decorators/intent-sensors.decorator";
export {
  HandlerSensors,
  HANDLER_SENSORS_KEY,
} from "./decorators/handler-sensors.decorator";
export { Sensor, SENSOR_METADATA_KEY } from "./decorators/sensor.decorator";
export type { SensorOptions, SensorPhase } from "./decorators/sensor.decorator";

// TLV Field Decorators
export {
  TlvField,
  TlvValidate,
  TlvUtf8Pattern,
  TlvMinLen,
  TlvEnum,
  TlvRange,
  TLV_FIELDS_KEY,
  TLV_VALIDATORS_KEY,
} from "./decorators/tlv-field.decorator";
export type {
  TlvFieldKind,
  TlvFieldOptions,
  TlvFieldMeta,
  TlvValidatorFn,
  TlvValidatorMeta,
} from "./decorators/tlv-field.decorator";

// DTO Schema Utilities
export {
  extractDtoSchema,
  buildDtoDecoder,
} from "./decorators/dto-schema.util";
export type { DtoSchema } from "./decorators/dto-schema.util";

// Base DTO Classes
export { AxisTlvDto } from "./base/axis-tlv.dto";
export { AxisIdDto } from "./base/axis-id.dto";
export { AxisPartialType } from "./base/axis-partial-type";
export {
  AxisResponseDto,
  RESPONSE_TAG_ID,
  RESPONSE_TAG_CREATED_AT,
  RESPONSE_TAG_UPDATED_AT,
  RESPONSE_TAG_CREATED_BY,
  RESPONSE_TAG_UPDATED_BY,
} from "./base/axis-response.dto";

// Engine
export { IntentRouter, AxisEffect } from "./engine/intent.router";
export { BAND, PRE_DECODE_BOUNDARY } from "./engine/sensor-bands";
export type { SensorBand } from "./engine/sensor-bands";

// Observation (protocol-level observation pipeline)
export { stableJsonStringify } from "./engine/observation/stable-json";
export type {
  ObservationQueueMessage,
  ObservationQueueConfig,
} from "./engine/observation/observation-queue.types";
export {
  buildQueueMessage,
  encodeQueueMessage,
  decodeQueueMessage,
  parseStreamEntries,
  parseAutoClaimEntries,
} from "./engine/observation/observation-queue.codec";
export type { ObservationStreamEntry } from "./engine/observation/observation-queue.codec";
export {
  canonicalizeObservation,
  hashObservation,
  buildUnsignedWitness,
} from "./engine/observation/observation-hash";
export type {
  ObservationWitnessSummary,
  UnsignedObservationWitness,
} from "./engine/observation/observation-hash";
export { verifyResponse } from "./engine/observation/response-observer";
// Compatibility alias
export { verifyResponse as ResponseObserver } from "./engine/observation/response-observer";
export type {
  ResponseObserverContext,
  ResponseContract,
  ObserverVerdict,
} from "./engine/observation/response-observer";

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
export type { AxisFrame, AxisBinaryFrame } from "./core/axis-bin";

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
  AxisCapsule,
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

// Upload handlers and stores
export {
  AxisFilesDownloadHandler,
  AxisFilesFinalizeHandler,
} from "./upload/axis-files.handlers";
export {
  AXIS_UPLOAD_FILE_STORE,
  AXIS_UPLOAD_RECEIPT_SIGNER,
  AXIS_UPLOAD_SESSION_STORE,
} from "./upload/upload.tokens";
export type {
  UploadFileStore,
  UploadFileStat,
  UploadReceiptSigner,
  UploadSessionRecord,
  UploadSessionStatus,
  UploadSessionStore,
} from "./upload/upload.types";
export { DiskUploadFileStore } from "./upload/disk-upload-file.store";

// Types

// Additional root exports for import ergonomics
export {
  AxisRaw,
  AxisIp,
  AxisContext,
  AxisDemoPubkey,
} from "./decorators/axis-request.decorator";
export type { AxisRequestData } from "./decorators/axis-request.decorator";
export { AxisError } from "./core/axis-error";
export { HandlerDiscoveryService } from "./engine/handler-discovery.service";
export { SensorDiscoveryService } from "./engine/sensor-discovery.service";
export { SensorRegistry } from "./engine/registry/sensor.registry";
export type { AxisDecoded } from "./engine/axis-decoded";
export {
  createObservation,
  startStage,
  endStage,
  recordSensor,
  finalizeObservation,
} from "./engine/axis-observation";
export type {
  AxisObservation,
  ObservationSensor,
  ObservationStage,
} from "./engine/axis-observation";
export { AxisSensorChainService } from "./security/axis-sensor-chain.service";
export type { ChainResult } from "./security/axis-sensor-chain.service";

// CCE — Capsule-Carried Encryption
export { executeCcePipeline } from "./cce/cce-pipeline";
export type {
  CceHandler,
  CceHandlerContext,
  CceHandlerResult,
  CcePipelineConfig,
  CcePipelineResult,
} from "./cce/cce-pipeline";
export { CCE_PROTOCOL_VERSION, CCE_ERROR, CceError } from "./cce/cce.types";
export type {
  CceCapsuleClaims as CceCapsuleClaimsType,
  CceRequestEnvelope as CceRequestEnvelopeType,
  CceResponseEnvelope as CceResponseEnvelopeType,
  CceExecutionContext as CceExecutionContextType,
  CceWitnessRecord as CceWitnessRecordType,
} from "./cce/cce.types";

// Utils
export { encodeAxisTlvDto } from "./utils/axis-tlv-codec";

// Loom runtime helpers and types
export {
  TLV_PRESENCE_ID,
  TLV_WRIT,
  TLV_THREAD_HASH,
  deriveAnchorReflection,
  canonicalizeWrit,
  canonicalizeGrant,
} from "./loom/loom.types";
export type {
  PresenceDeclaration,
  PresenceChallenge,
  PresenceProof,
  PresenceReceipt,
  PresenceStatus,
  WritHead,
  WritBody,
  WritMeta,
  WritSignature,
  Writ,
  GrantType,
  GrantCapability,
  GrantMeta,
  Grant,
  GrantStatus,
  LoomReceipt,
  ThreadState,
  RevocationTargetType,
  Revocation,
  LoomValidationResult,
  PresenceVerifyResult,
  WritValidationResult,
  GrantValidationResult,
} from "./loom/loom.types";

// Grouped namespaces for the backend package merge surface
export * as cce from "./cce";
export * as core from "./core";
export * as crypto from "./crypto";
export * as decorators from "./decorators";
export * as engine from "./engine";
export * as loom from "./loom";
export * as schemas from "./schemas";
export * as security from "./security";
export * as sensors from "./sensors";
export * as utils from "./utils";
