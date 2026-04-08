/**
 * CCE Sensors — Index
 *
 * All CCE security sensors in execution order:
 *
 * 1. CceEnvelopeValidationSensor  (order: 5,  WIRE)     — Schema + version check
 * 2. CceClientSignatureSensor     (order: 45, IDENTITY) — Client key resolve + sig verify
 * 3. CceCapsuleVerificationSensor (order: 50, IDENTITY) — Capsule parse + TickAuth sig verify
 * 4. CceTpsWindowSensor           (order: 92, POLICY)   — TPS window validation
 * 5. CceAudienceIntentBindingSensor (order: 95, POLICY) — Audience + intent binding
 * 6. CceReplayProtectionSensor    (order: 98, POLICY)   — Replay + nonce check
 * 7. CcePayloadDecryptionSensor   (order: 145, CONTENT) — Key unwrap + AES-GCM decrypt
 */

export { CceEnvelopeValidationSensor } from "./cce-envelope-validation.sensor";

export {
  CceClientSignatureSensor,
  type CceClientKeyResolver,
  type CceSignatureVerifier,
} from "./cce-client-signature.sensor";

export {
  CceCapsuleVerificationSensor,
  type CceIssuerKeyResolver,
  type CceCapsuleSignatureVerifier,
} from "./cce-capsule-verification.sensor";

export { CceTpsWindowSensor } from "./cce-tps-window.sensor";

export { CceAudienceIntentBindingSensor } from "./cce-audience-intent-binding.sensor";

export {
  CceReplayProtectionSensor,
  InMemoryCceReplayStore,
  type CceReplayStore,
} from "./cce-replay-protection.sensor";

export {
  CcePayloadDecryptionSensor,
  type CceAxisKeyProvider,
  type CceAesGcmProvider,
  type CcePayloadValidator,
  type CcePayloadValidatorResult,
} from "./cce-payload-decryption.sensor";
