import * as crypto from 'crypto';

import { AxisFrame, getSignTarget } from './axis-bin';

/**
 * Signature utilities for AXIS binary frames
 * Supports Ed25519 signature generation and verification
 */

/**
 * Computes the canonical payload for signing an AXIS frame.
 * The signature covers all bytes of the encoded frame EXCEPT the signature field itself.
 *
 * @param {AxisFrame} frame - The frame to prepare for signing
 * @returns {Buffer} The serialized canonical bytes for the signature algorithm
 */
export function computeSignaturePayload(frame: AxisFrame): Buffer {
  return Buffer.from(getSignTarget(frame));
}

/**
 * Signs an AXIS frame using the Ed25519 algorithm.
 * Automatically handles both raw 32-byte seeds and pkcs8 DER-encoded private keys.
 *
 * @param {AxisFrame} frame - The frame to sign
 * @param {Buffer} privateKey - Ed25519 private key (32-byte raw OR pkcs8 DER)
 * @returns {Buffer} The 64-byte Ed25519 signature
 * @throws {Error} If key format is invalid or signing fail
 */
export function signFrame(frame: AxisFrame, privateKey: Buffer): Buffer {
  const payload = computeSignaturePayload(frame);

  let keyObject: crypto.KeyObject;

  // Check if key is raw 32-byte seed or DER-encoded
  if (privateKey.length === 32) {
    // Raw seed - wrap in pkcs8 DER format
    // pkcs8 prefix for Ed25519: 0x302e020100300506032b657004220420
    const pkcs8Prefix = Buffer.from([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8Key = Buffer.concat([pkcs8Prefix, privateKey]);

    keyObject = crypto.createPrivateKey({
      key: pkcs8Key,
      format: 'der',
      type: 'pkcs8',
    });
  } else {
    // Assume already DER-encoded pkcs8
    keyObject = crypto.createPrivateKey({
      key: privateKey,
      format: 'der',
      type: 'pkcs8',
    });
  }

  const signature = crypto.sign(null, payload, keyObject);

  if (signature.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }

  return signature;
}

/**
 * Verifies an Ed25519 signature on an AXIS frame.
 * Automatically handles both raw 32-byte public keys and spki DER-encoded public keys.
 *
 * @param {AxisFrame} frame - The frame containing the signature to verify
 * @param {Buffer} publicKey - Ed25519 public key (32-byte raw OR spki DER)
 * @returns {boolean} True if the signature is cryptographically valid
 * @throws {Error} If signature length is invalid
 */
export function verifyFrameSignature(
  frame: AxisFrame,
  publicKey: Buffer,
): boolean {
  if (frame.sig.length === 0) {
    return false; // No signature
  }

  if (frame.sig.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }

  const payload = computeSignaturePayload(frame);

  try {
    let keyObject: crypto.KeyObject;

    // Check if key is raw 32-byte or DER-encoded
    if (publicKey.length === 32) {
      // Raw key - wrap in spki DER format
      // spki prefix for Ed25519: 0x302a300506032b6570032100
      const spkiPrefix = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
      ]);
      const spkiKey = Buffer.concat([spkiPrefix, publicKey]);

      keyObject = crypto.createPublicKey({
        key: spkiKey,
        format: 'der',
        type: 'spki',
      });
    } else {
      // Assume already DER-encoded spki
      keyObject = crypto.createPublicKey({
        key: publicKey,
        format: 'der',
        type: 'spki',
      });
    }

    const valid = crypto.verify(
      null,
      payload,
      keyObject,
      Buffer.from(frame.sig),
    );
    return valid;
  } catch (error) {
    return false;
  }
}

/**
 * Generates a new Ed25519 key pair for use with the AXIS protocol.
 * Returns keys in canonical DER format (pkcs8 for private, spki for public).
 *
 * @returns {Object} An object containing the privateKey and publicKey as Buffers
 */
export function generateEd25519KeyPair(): {
  privateKey: Buffer;
  publicKey: Buffer;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer,
    publicKey: publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
  };
}

/**
 * Computes a standard SHA-256 hash of the provided data.
 *
 * @param {Buffer | Uint8Array} data - The input data to hash
 * @returns {Buffer} The 32-byte SHA-256 digest
 */
export function sha256(data: Buffer | Uint8Array): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Computes a hash for an AXIS receipt, optionally chaining it to a previous hash.
 * This is used for generating an immutable transaction chain.
 *
 * @param {Buffer | Uint8Array} receiptBytes - The canonical binary representation of the receipt
 * @param {Buffer | Uint8Array} [prevHash] - The hash of the previous receipt in the chain
 * @returns {Buffer} The 32-byte SHA-256 hash of the receipt (and link)
 */
export function computeReceiptHash(
  receiptBytes: Buffer | Uint8Array,
  prevHash?: Buffer | Uint8Array,
): Buffer {
  const hasher = crypto.createHash('sha256');
  hasher.update(receiptBytes);

  if (prevHash && prevHash.length > 0) {
    hasher.update(prevHash);
  }

  return hasher.digest();
}
