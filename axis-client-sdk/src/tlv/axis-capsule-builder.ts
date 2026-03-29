/**
 * AXIS Capsule Builder with Signing Support
 * Builds AXIS frames with optional Ed25519 signature.
 * Uses varint TLV encoding (compatible with backend).
 */

import { TLV, encodeTLVs, decodeTLVs, pack, tlvString, tlvBytes, getOne } from './axis-tlv';
import { AXIS_TAG } from './axis-tags';
import type { Signer } from '../signer';

/**
 * Builds the signing region (header + body bytes).
 * This is what gets signed for AXIS frames.
 */
export function buildSigningRegion(headerBytes: Uint8Array, bodyBytes: Uint8Array): Uint8Array {
  const total = new Uint8Array(headerBytes.length + bodyBytes.length);
  total.set(headerBytes, 0);
  total.set(bodyBytes, headerBytes.length);
  return total;
}

/**
 * Create a PROOF_PACK TLV containing signature, algorithm, and public key.
 * This is for nested proof structures (extension format).
 */
export function buildProofPack(
  alg: string,
  pubKey: Uint8Array,
  signature: Uint8Array
): TLV {
  return pack(AXIS_TAG.PROOF_PACK, [
    tlvString(AXIS_TAG.SIGN_ALG, alg),
    tlvBytes(AXIS_TAG.PUBKEY, pubKey),
    tlvBytes(AXIS_TAG.SIGNATURE, signature),
  ]);
}

/**
 * Sign header + body bytes using the provided signer.
 * Returns the signature bytes (to be used in frame construction).
 *
 * @param headerBytes - Encoded header TLVs
 * @param bodyBytes - Encoded body bytes
 * @param signer - The signer to use for signing
 * @returns Signature bytes
 */
export async function signTlvFrame(
  headerBytes: Uint8Array,
  bodyBytes: Uint8Array,
  signer: Signer
): Promise<Uint8Array> {
  const signingRegion = buildSigningRegion(headerBytes, bodyBytes);
  return signer.sign(signingRegion);
}

/** @deprecated Use signTlvFrame */
export const signFrame = signTlvFrame;

/**
 * Verify TLV-encoded frame signature.
 * Uses @noble/ed25519 for Ed25519 verification.
 *
 * @param headerBytes - Encoded header TLVs
 * @param bodyBytes - Encoded body bytes
 * @param signature - The signature to verify
 * @param publicKey - The public key to verify against
 * @returns Promise<boolean> - true if signature is valid
 */
export async function verifyTlvFrameSignature(
  headerBytes: Uint8Array,
  bodyBytes: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const signingRegion = buildSigningRegion(headerBytes, bodyBytes);
  const ed = await import('@noble/ed25519');
  return ed.verifyAsync(signature, signingRegion, publicKey);
}
/** @deprecated Use verifyTlvFrameSignature */
export const verifyFrameSignature = verifyTlvFrameSignature;
/**
 * Extract signature components from a PROOF_PACK TLV.
 */
export function extractProofPack(proofPackValue: Uint8Array): {
  alg: string;
  pubKey: Uint8Array;
  signature: Uint8Array;
} | null {
  try {
    const proofInner = decodeTLVs(proofPackValue);
    const algValue = getOne(proofInner, AXIS_TAG.SIGN_ALG);
    const pubKeyValue = getOne(proofInner, AXIS_TAG.PUBKEY);
    const sigValue = getOne(proofInner, AXIS_TAG.SIGNATURE);

    if (!algValue || !pubKeyValue || !sigValue) return null;

    return {
      alg: new TextDecoder().decode(algValue),
      pubKey: pubKeyValue,
      signature: sigValue,
    };
  } catch {
    return null;
  }
}
