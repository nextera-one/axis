/**
 * Canonical JSON serialization for stable cryptographic signing
 *
 * Rules:
 * - Recursively sort object keys lexicographically
 * - Remove undefined values
 * - Preserve array order
 * - No whitespace in output
 * - Stable number formatting
 */

/**
 * Recursively sort object keys and remove undefined values
 */
function sortRec(value: any): any {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map(sortRec);
  }

  if (typeof value === 'object') {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(value).sort();

    for (const key of keys) {
      const sortedValue = sortRec(value[key]);
      // Skip undefined values
      if (sortedValue !== undefined) {
        sorted[key] = sortedValue;
      }
    }

    return sorted;
  }

  // Primitive types (number, string, boolean)
  return value;
}

/**
 * Convert value to canonical JSON string for signing
 *
 * @param value - Value to canonicalize
 * @returns Canonical JSON string (no whitespace, sorted keys, no undefined)
 */
export function canonicalJson(value: any): string {
  return JSON.stringify(sortRec(value));
}

/**
 * Helper to create canonical JSON for signing (excluding specific fields)
 *
 * @param obj - Object to canonicalize
 * @param exclude - Fields to exclude (e.g., 'sig' when signing)
 * @returns Canonical JSON string
 */
export function canonicalJsonExcluding(
  obj: Record<string, any>,
  exclude: string[],
): string {
  const filtered: Record<string, any> = {};

  for (const key in obj) {
    if (!exclude.includes(key) && obj[key] !== undefined) {
      filtered[key] = obj[key];
    }
  }

  return canonicalJson(filtered);
}
