/**
 * CCE Client Module — Index
 *
 * Client-side Capsule-Carried Encryption for AXIS Protocol.
 */

export {
  CCE_PROTOCOL_VERSION,
  CCE_NONCE_BYTES,
  buildCceRequest,
  decryptCceResponse,
  type CceSignature,
  type CceCapsuleClaims,
  type CceEncryptedKey,
  type CceEncryptedPayload,
  type CceRequestEnvelope,
  type CceResponseEnvelope,
  type CceClientSigner,
  type CceKeyEncryptor,
  type CceKeyDecryptor,
  type CceAesProvider,
  type CceAxisSignatureVerifier,
  type BuildCceRequestOptions,
  type DecryptCceResponseOptions,
} from "./cce-client";

export { WebCryptoAesProvider } from "./cce-webcrypto";
