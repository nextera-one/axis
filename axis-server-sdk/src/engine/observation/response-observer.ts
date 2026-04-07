import { MAX_BODY_LEN } from '../../core/constants';

/**
 * Minimal request context needed by ResponseObserver.
 * Compatible with the full AxisContext from schemas.
 */
export interface ResponseObserverContext {
  actorId: string;
  intent: string;
}

/**
 * Response contract that the observer validates.
 */
export interface ResponseContract {
  /** Whether the handler reported success */
  ok: boolean;
  /** The effect label returned by the handler */
  effect: string;
  /** Response body bytes (may be undefined for error responses) */
  body?: Uint8Array;
  /** Response TLV headers */
  headers?: Map<number, Uint8Array>;
}

/**
 * Result of observer validation.
 */
export interface ObserverVerdict {
  /** true = response passes all checks */
  passed: boolean;
  /** Machine-readable code if rejected */
  code?: string;
  /** Human-readable reason if rejected */
  reason?: string;
}

/** TLV tags that must never appear in a response (ACTOR_ID, PROOF_TYPE, PROOF_REF). */
const SENSITIVE_RESPONSE_TAGS = [4, 5, 6];

/**
 * ResponseObserver — post-execution policy gate (protocol layer).
 *
 * Validates that:
 * 1. Effect is a valid non-empty string.
 * 2. Mandatory response body exists for successful results.
 * 3. No sensitive data leaks in response headers.
 * 4. Response size is within protocol limits.
 * 5. Effect does not expose internal error details.
 *
 * This is a defense-in-depth layer — primary correctness comes from
 * deterministic execution, signature verification, and nonce/replay controls.
 *
 * On failure, the engine returns a safe error instead of the original response.
 */
export function verifyResponse(
  ctx: ResponseObserverContext,
  response: ResponseContract,
): ObserverVerdict {
  // 1. Effect must be a non-empty string
  if (!response.effect || typeof response.effect !== 'string') {
    return {
      passed: false,
      code: 'OBSERVER_INVALID_EFFECT',
      reason: 'Response effect is missing or invalid',
    };
  }

  // 2. Successful responses must have a body
  if (response.ok && (!response.body || response.body.length === 0)) {
    return {
      passed: false,
      code: 'OBSERVER_EMPTY_BODY',
      reason: 'Successful response must contain a body',
    };
  }

  // 3. Response body must not exceed protocol limits
  if (response.body && response.body.length > MAX_BODY_LEN) {
    return {
      passed: false,
      code: 'OBSERVER_BODY_OVERFLOW',
      reason: `Response body exceeds ${MAX_BODY_LEN} bytes`,
    };
  }

  // 4. Verify no sensitive TLV tags leak in response headers
  if (response.headers) {
    for (const tag of SENSITIVE_RESPONSE_TAGS) {
      if (response.headers.has(tag)) {
        return {
          passed: false,
          code: 'OBSERVER_DATA_LEAK',
          reason: `Response must not contain sensitive TLV tag ${tag}`,
        };
      }
    }
  }

  // 5. Effect should not expose internal error details
  if (
    response.effect.includes('Error:') ||
    response.effect.includes('stack') ||
    response.effect.includes('at /')
  ) {
    return {
      passed: false,
      code: 'OBSERVER_INFO_LEAK',
      reason: 'Response effect may contain internal error details',
    };
  }

  return { passed: true };
}

/**
 * Function type and value alias for the response observer validator.
 */
export type ResponseObserver = (
  ctx: ResponseObserverContext,
  response: ResponseContract,
) => ObserverVerdict;

export const ResponseObserver: ResponseObserver = verifyResponse;
