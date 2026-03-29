/**
 * AXIS Opcode Registry
 * Central registry of all allowed opcodes.
 * Unknown opcodes are rejected by default (no shadow endpoints).
 */

export const AXIS_OPCODES = new Set([
  'CAPSULE.ISSUE',
  'CAPSULE.BATCH',
  'CAPSULE.REVOKE',
  'INTENT.EXEC',
  'ACTOR.KEY.ROTATE',
  'ACTOR.KEY.REVOKE',
  'ISSUER.KEY.ROTATE',
  // NestFlow opcodes
  'AUTH.WEB.LOGIN',
  'AUTH.WEB.SCAN',
  'TICKAUTH.CREATE',
  'TICKAUTH.FULFILL',
  'TICKAUTH.REJECT',
  'SESSION.ACTIVATE',
  'SESSION.REFRESH',
  'SESSION.LOGOUT',
  'DEVICE.TRUST',
  'DEVICE.PROMOTE',
  'DEVICE.REVOKE',
  'DEVICE.LIST',
  'DEVICE.RENAME',
  'IDENTITY.RECOVERY',
  'IDENTITY.LOCK',
]);

export function isKnownOpcode(op: string): boolean {
  return AXIS_OPCODES.has(op);
}

/**
 * Returns true if the opcode requires elevated permissions.
 */
export function isAdminOpcode(op: string): boolean {
  return (
    op.startsWith('ACTOR.KEY.') ||
    op.startsWith('ISSUER.KEY.') ||
    op.startsWith('IDENTITY.')
  );
}
