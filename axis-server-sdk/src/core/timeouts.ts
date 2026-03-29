/**
 * AXIS Intent Timeout Configuration
 * Protocol-level per-intent execution time limits.
 */

/**
 * Per-intent timeout configuration (milliseconds).
 * Patterns ending with '.*' match any intent with that prefix.
 */
export const INTENT_TIMEOUTS: Record<string, number> = {
  'public.*': 5000,
  'schema.*': 5000,
  'catalog.*': 5000,
  'health.*': 2000,

  'file.upload': 60000,
  'file.download': 60000,
  'file.chunk': 30000,
  'file.finalize': 30000,

  'stream.*': 30000,

  'passport.*': 15000,

  'admin.*': 30000,
};

/** Default timeout for unspecified intents */
export const DEFAULT_TIMEOUT = 10000;

/**
 * Resolves the timeout for a given intent.
 *
 * Lookup strategy:
 * 1. Exact intent match
 * 2. Prefix pattern match (e.g. 'file.*')
 * 3. DEFAULT_TIMEOUT
 */
export function resolveTimeout(intent: string): number {
  if (INTENT_TIMEOUTS[intent]) {
    return INTENT_TIMEOUTS[intent];
  }

  for (const [pattern, timeout] of Object.entries(INTENT_TIMEOUTS)) {
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1);
      if (intent.startsWith(prefix)) {
        return timeout;
      }
    }
  }

  return DEFAULT_TIMEOUT;
}
