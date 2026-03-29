/**
 * Base64url encoding/decoding utilities
 * RFC 4648 base64url (URL-safe, no padding)
 */

/**
 * Encode buffer to base64url string
 * @param buf - Buffer to encode
 * @returns Base64url string (no padding, URL-safe)
 */
export function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Decode base64url string to buffer
 * @param str - Base64url string
 * @returns Decoded buffer
 */
export function b64urlDecode(str: string): Buffer {
  // Add padding if needed
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64');
}

/**
 * Encode string to base64url
 * @param str - String to encode
 * @param encoding - String encoding (default: utf8)
 * @returns Base64url string
 */
export function b64urlEncodeString(
  str: string,
  encoding: BufferEncoding = 'utf8',
): string {
  return b64urlEncode(Buffer.from(str, encoding));
}

/**
 * Decode base64url string to string
 * @param str - Base64url string
 * @param encoding - String encoding (default: utf8)
 * @returns Decoded string
 */
export function b64urlDecodeString(
  str: string,
  encoding: BufferEncoding = 'utf8',
): string {
  return b64urlDecode(str).toString(encoding);
}
