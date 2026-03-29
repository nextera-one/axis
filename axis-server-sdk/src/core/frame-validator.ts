/**
 * AXIS Frame Shape Validator
 * Validates structural integrity of AXIS frames before cryptographic verification.
 */

/**
 * Validates that a value has the structural shape of an AXIS Frame.
 * Checks version, required string fields, timestamp, signature envelope, and body.
 *
 * Note: This validates the JSON-level frame shape (v1 packet format).
 * For binary frame validation, use decodeFrame() which throws on malformed input.
 */
export function validateFrameShape(frame: any): boolean {
  if (!frame || typeof frame !== 'object') {
    return false;
  }

  if (frame.v !== 1) {
    return false;
  }

  const requiredStrings = ['pid', 'nonce', 'actorId', 'opcode'];
  for (const key of requiredStrings) {
    if (typeof frame[key] !== 'string' || frame[key].length < 6) {
      return false;
    }
  }

  if (typeof frame.ts !== 'number' || !Number.isFinite(frame.ts)) {
    return false;
  }

  if (
    frame.aud !== undefined &&
    (typeof frame.aud !== 'string' || frame.aud.length === 0)
  ) {
    return false;
  }

  if (!frame.sig || typeof frame.sig !== 'object') {
    return false;
  }

  if (frame.sig.alg !== 'EdDSA') {
    return false;
  }

  if (typeof frame.sig.kid !== 'string' || frame.sig.kid.length < 8) {
    return false;
  }

  if (typeof frame.sig.value !== 'string' || frame.sig.value.length < 32) {
    return false;
  }

  if (typeof frame.body !== 'object' || frame.body === null) {
    return false;
  }

  return true;
}

/**
 * Validates timestamp is within acceptable skew window.
 */
export function isTimestampValid(
  ts: number,
  skewSeconds: number = 120,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - ts);
  return diff <= skewSeconds;
}
