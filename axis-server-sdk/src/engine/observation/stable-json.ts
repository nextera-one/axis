/**
 * Deterministic JSON serialization for observation hashing.
 *
 * Sorts object keys alphabetically and strips `undefined` values
 * so that two structurally equivalent observations always produce
 * the same string — required for reproducible SHA-256 hashing.
 */

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    const normalized: Record<string, unknown> = {};
    for (const [key, nested] of entries) {
      normalized[key] = normalize(nested);
    }
    return normalized;
  }

  return value;
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}
