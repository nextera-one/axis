/**
 * AXIS Scope Utilities
 * Validates capsule scopes against required resource access.
 * Prevents BOLA (Broken Object Level Authorization) attacks.
 */

/**
 * Check if a capsule has the required scope.
 * Scopes use colon notation: resource:id or resource:*
 *
 * Examples:
 * - wallet:w_123
 * - merchant:m_456
 * - payment:*
 */
export function hasScope(scopes: string[], required: string): boolean {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return false;
  }

  // Exact match
  if (scopes.includes(required)) {
    return true;
  }

  // Wildcard match: resource:* matches resource:anything
  const [resource, id] = required.split(':');
  if (resource && id) {
    const wildcard = `${resource}:*`;
    if (scopes.includes(wildcard)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract resource type and ID from scope.
 */
export function parseScope(
  scope: string,
): { resource: string; id: string } | null {
  const parts = scope.split(':');
  if (parts.length !== 2) return null;
  return { resource: parts[0], id: parts[1] };
}

/**
 * Check if actor can access a specific resource based on capsule scopes.
 */
export function canAccessResource(
  scopes: string[],
  resourceType: string,
  resourceId: string,
): boolean {
  const required = `${resourceType}:${resourceId}`;
  return hasScope(scopes, required);
}
