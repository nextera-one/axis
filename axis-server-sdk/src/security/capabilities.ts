/**
 * AXIS Capability Model
 * Maps proof types to capabilities and intents to requirements.
 */
import { PROOF_CAPSULE, PROOF_JWT, PROOF_LOOM, PROOF_MTLS, PROOF_NONE, PROOF_WITNESS } from '../core/constants';

/**
 * Available capabilities in the AXIS system.
 * Each represents a distinct permission level.
 */
export const CAPABILITIES = {
  read: 'read',
  write: 'write',
  execute: 'execute',
  admin: 'admin',
  sign: 'sign',
  witness: 'witness',
} as const;

export type Capability = keyof typeof CAPABILITIES;

/**
 * Maps proof type codes to granted capabilities.
 */
export const PROOF_CAPABILITIES: Record<number, Capability[]> = {
  [PROOF_NONE]: [],
  [PROOF_CAPSULE]: ['read', 'write', 'execute'],
  [PROOF_JWT]: ['read'],
  [PROOF_MTLS]: ['read', 'write', 'admin'],
  [PROOF_LOOM]: ['read', 'write', 'execute'],
  [PROOF_WITNESS]: ['read', 'write', 'execute', 'witness'],
};

/**
 * Maps intent patterns to required capabilities.
 * Patterns ending with '.*' match any intent with that prefix.
 */
export const INTENT_REQUIREMENTS: Record<string, Capability[]> = {
  'public.*': [],
  'schema.*': [],
  'catalog.*': [],
  'health.*': [],
  'system.*': [],

  'file.upload': ['write'],
  'file.download': ['read'],
  'file.delete': ['write', 'admin'],

  'passport.issue': ['write', 'execute'],
  'passport.revoke': ['write', 'witness'],

  'stream.publish': ['write'],
  'stream.subscribe': ['read'],

  // NestFlow intents
  'auth.web.login.*': ['execute'],
  'tickauth.challenge.*': ['execute'],
  'capsule.issue.*': ['write', 'execute'],
  'session.*': ['execute'],
  'device.list': ['read'],
  'device.rename': ['write'],
  'device.trust.*': ['write', 'execute'],
  'device.revoke': ['write', 'execute'],
  'identity.*': ['admin', 'execute'],
  'primary.device.*': ['admin', 'execute'],
  'secret.rotate': ['admin'],
  'org.security.*': ['admin'],
  'production.execution.*': ['admin', 'execute'],

  'admin.*': ['admin'],
};
