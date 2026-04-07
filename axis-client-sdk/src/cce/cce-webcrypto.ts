/**
 * CCE WebCrypto Provider
 *
 * Browser-compatible AES-GCM and X25519 implementations using WebCrypto API.
 * Falls back to Node.js crypto when WebCrypto is not available.
 */
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

import type { CceAesProvider, CceEncryptedKey } from "./cce-client";

// ============================================================================
// Base64url helpers
// ============================================================================

function base64UrlEncode(bytes: Uint8Array): string {
  // Browser-compatible base64url
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================================================
// WebCrypto AES-GCM Provider
// ============================================================================

/** Convert Uint8Array to ArrayBuffer (safe for WebCrypto which rejects SharedArrayBuffer). */
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength,
  ) as ArrayBuffer;
}

/**
 * AES-GCM provider using the WebCrypto API.
 * Works in both browser and Node.js 16+ environments.
 */
export class WebCryptoAesProvider implements CceAesProvider {
  async encrypt(
    key: Uint8Array,
    plaintext: Uint8Array,
    aad?: Uint8Array,
  ): Promise<{ iv: string; ciphertext: string; tag: string }> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(key),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const params: AesGcmParams = {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      tagLength: 128,
    };
    if (aad) {
      params.additionalData = toArrayBuffer(aad);
    }

    const result = await crypto.subtle.encrypt(
      params,
      cryptoKey,
      toArrayBuffer(plaintext),
    );
    const resultBytes = new Uint8Array(result);

    // WebCrypto appends the auth tag to the ciphertext
    const ciphertextBytes = resultBytes.slice(0, resultBytes.length - 16);
    const tagBytes = resultBytes.slice(resultBytes.length - 16);

    return {
      iv: base64UrlEncode(iv),
      ciphertext: base64UrlEncode(ciphertextBytes),
      tag: base64UrlEncode(tagBytes),
    };
  }

  async decrypt(
    key: Uint8Array,
    iv: string,
    ciphertext: string,
    tag: string,
    aad?: Uint8Array,
  ): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(key),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const ivBytes = base64UrlDecode(iv);
    const ciphertextBytes = base64UrlDecode(ciphertext);
    const tagBytes = base64UrlDecode(tag);

    // WebCrypto expects tag appended to ciphertext
    const combined = new Uint8Array(ciphertextBytes.length + tagBytes.length);
    combined.set(ciphertextBytes, 0);
    combined.set(tagBytes, ciphertextBytes.length);

    const params: AesGcmParams = {
      name: "AES-GCM",
      iv: toArrayBuffer(ivBytes),
      tagLength: 128,
    };
    if (aad) {
      params.additionalData = toArrayBuffer(aad);
    }

    const result = await crypto.subtle.decrypt(
      params,
      cryptoKey,
      toArrayBuffer(combined),
    );
    return new Uint8Array(result);
  }
}
