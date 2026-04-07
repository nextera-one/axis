/**
 * CCE Module — Index
 *
 * Capsule-Carried Encryption for AXIS Protocol (Server SDK)
 *
 * Architecture:
 * - cce.types:      Core types, error codes, envelope definitions
 * - cce-derivation: HKDF key derivation and execution context
 * - cce-crypto:     AES-GCM encryption/decryption primitives
 * - cce-response:   Response encryption and signing
 * - cce-witness:    Witness/OpenLogs observer
 * - cce-pipeline:   Full request/response orchestrator
 * - sensors/:       7 CCE security sensors for the verification chain
 */

// Types and Constants
export {
  CCE_PROTOCOL_VERSION,
  CCE_DERIVATION,
  CCE_AES_KEY_BYTES,
  CCE_IV_BYTES,
  CCE_TAG_BYTES,
  CCE_NONCE_BYTES,
  CCE_ERROR,
  CceError,
  type CceAlgorithm,
  type CceKemAlgorithm,
  type CceKdfAlgorithm,
  type CceCapsuleClaims,
  type CceConstraints,
  type CceSignature,
  type CceRequestEnvelope,
  type CceResponseEnvelope,
  type CceResponseStatus,
  type CceEncryptedKey,
  type CceEncryptedPayload,
  type CceAlgorithmDescriptor,
  type CceExecutionContext,
  type CceWitnessRecord,
  type CceErrorCode,
} from "./cce.types";

// Key Derivation
export {
  deriveRequestExecutionKey,
  deriveResponseExecutionKey,
  deriveWitnessKey,
  buildExecutionContext,
  generateCceNonce,
  type CceDerivationInput,
} from "./cce-derivation.service";

// Crypto Primitives
export {
  aesGcmEncrypt,
  aesGcmDecrypt,
  generateAesKey,
  generateIv,
  base64UrlEncode,
  base64UrlDecode,
  hashPayload,
  nodeAesGcmProvider,
} from "./cce-crypto";

// Response Encryption
export {
  buildCceResponse,
  buildCceErrorResponse,
  type CceClientKeyEncryptor,
  type CceAxisSigner,
  type CceResponseOptions,
} from "./cce-response.service";

// Witness Observer
export {
  buildWitnessRecord,
  extractVerificationState,
  InMemoryCceWitnessStore,
  type CceWitnessStore,
  type CceVerificationState,
} from "./cce-witness.observer";

// Pipeline Orchestrator
export {
  executeCcePipeline,
  type CceHandler,
  type CceHandlerContext,
  type CceHandlerResult,
  type CcePipelineConfig,
  type CcePipelineResult,
} from "./cce-pipeline";

// Sensors
export {
  CceEnvelopeValidationSensor,
  CceClientSignatureSensor,
  CceCapsuleVerificationSensor,
  CceTpsWindowSensor,
  CceAudienceIntentBindingSensor,
  CceReplayProtectionSensor,
  CcePayloadDecryptionSensor,
  InMemoryCceReplayStore,
  type CceClientKeyResolver,
  type CceSignatureVerifier,
  type CceIssuerKeyResolver,
  type CceCapsuleSignatureVerifier,
  type CceReplayStore,
  type CceAxisKeyProvider,
  type CceAesGcmProvider,
} from "./sensors";
