import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
/**
 * CCE Crypto Primitives
 *
 * AES-256-GCM encryption/decryption and X25519 key exchange
 * for the Capsule-Carried Encryption protocol.
 *
 * Uses Node.js native crypto for AES-GCM (performant and FIPS-capable).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { CCE_AES_KEY_BYTES, CCE_IV_BYTES, CCE_TAG_BYTES } from "./cce.types";

// ============================================================================
// AES-256-GCM
// ============================================================================

/**
 * Encrypt plaintext with AES-256-GCM.
 */
export function aesGcmEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): { iv: Uint8Array; ciphertext: Uint8Array; tag: Uint8Array } {
  if (key.length !== CCE_AES_KEY_BYTES) {
    throw new Error(`AES key must be ${CCE_AES_KEY_BYTES} bytes`);
  }

  const iv = randomBytes(CCE_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  if (aad) {
    cipher.setAAD(aad);
  }

  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: new Uint8Array(iv),
    ciphertext: new Uint8Array(encrypted),
    tag: new Uint8Array(tag),
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM.
 * Returns null if AEAD tag verification fails.
 */
export function aesGcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad?: Uint8Array,
): Uint8Array | null {
  if (key.length !== CCE_AES_KEY_BYTES) {
    throw new Error(`AES key must be ${CCE_AES_KEY_BYTES} bytes`);
  }
  if (iv.length !== CCE_IV_BYTES) {
    throw new Error(`IV must be ${CCE_IV_BYTES} bytes`);
  }
  if (tag.length !== CCE_TAG_BYTES) {
    throw new Error(`Tag must be ${CCE_TAG_BYTES} bytes`);
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    if (aad) {
      decipher.setAAD(aad);
    }

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return new Uint8Array(decrypted);
  } catch {
    // AEAD tag mismatch or other decryption failure
    return null;
  }
}

/**
 * Generate an ephemeral AES-256 key.
 */
export function generateAesKey(): Uint8Array {
  return new Uint8Array(randomBytes(CCE_AES_KEY_BYTES));
}

/**
 * Generate a random IV for AES-GCM.
 */
export function generateIv(): Uint8Array {
  return new Uint8Array(randomBytes(CCE_IV_BYTES));
}

// ============================================================================
// Base64url helpers
// ============================================================================

export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return new Uint8Array(Buffer.from(base64 + padding, "base64"));
}

// ============================================================================
// Payload hashing (for witness records)
// ============================================================================

/**
 * Hash a payload for witness records (never store raw plaintext).
 */
export function hashPayload(payload: Uint8Array): string {
  return bytesToHex(sha256(payload));
}

// ============================================================================
// Default AES-GCM Provider (for sensor injection)
// ============================================================================

import type { CceAesGcmProvider } from "./sensors/cce-payload-decryption.sensor";

/**
 * Node.js native AES-GCM provider.
 */
export const nodeAesGcmProvider: CceAesGcmProvider = {
  async decrypt(
    key: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array,
    tag: Uint8Array,
    aad?: Uint8Array,
  ): Promise<Uint8Array | null> {
    return aesGcmDecrypt(key, iv, ciphertext, tag, aad);
  },
};
