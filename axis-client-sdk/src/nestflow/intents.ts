/**
 * NestFlow AXIS Intent Constants
 *
 * Standardized intent names for the NestFlow passwordless auth flow.
 * These match the server-sdk intent registry.
 */

export const NestFlowIntents = {
  // Auth — QR web login
  AUTH_WEB_LOGIN_REQUEST: 'auth.web.login.request',
  AUTH_WEB_LOGIN_SCAN: 'auth.web.login.scan',

  // TickAuth — temporal challenges
  TICKAUTH_CHALLENGE_CREATE: 'tickauth.challenge.create',
  TICKAUTH_CHALLENGE_FULFILL: 'tickauth.challenge.fulfill',
  TICKAUTH_CHALLENGE_REJECT: 'tickauth.challenge.reject',

  // Capsule — authorization proof issuance
  CAPSULE_ISSUE_LOGIN: 'capsule.issue.login',
  CAPSULE_ISSUE_DEVICE_REGISTRATION: 'capsule.issue.device_registration',
  CAPSULE_ISSUE_STEP_UP: 'capsule.issue.step_up',
  CAPSULE_ISSUE_RECOVERY: 'capsule.issue.recovery',

  // Session — runtime management
  SESSION_ACTIVATE: 'session.activate',
  SESSION_REFRESH: 'session.refresh',
  SESSION_LOGOUT: 'session.logout',

  // Device — trust management
  DEVICE_TRUST_REQUEST: 'device.trust.request',
  DEVICE_TRUST_PROMOTE: 'device.trust.promote',
  DEVICE_REVOKE: 'device.revoke',
  DEVICE_LIST: 'device.list',
  DEVICE_RENAME: 'device.rename',

  // Protected actions (step-up required)
  FLOW_PUBLISH: 'flow.publish',
  FLOW_DELETE: 'flow.delete',
  NODE_DELETE: 'node.delete',
  SECRET_ROTATE: 'secret.rotate',
  ORG_SECURITY_UPDATE: 'org.security.update',
  PRODUCTION_EXECUTION_APPROVE: 'production.execution.approve',

  // Recovery
  IDENTITY_RECOVERY_START: 'identity.recovery.start',
  IDENTITY_RECOVERY_COMPLETE: 'identity.recovery.complete',
  PRIMARY_DEVICE_ROTATE: 'primary.device.rotate',
  IDENTITY_LOCK: 'identity.lock',
  IDENTITY_UNLOCK: 'identity.unlock',
} as const;

export type NestFlowIntent =
  (typeof NestFlowIntents)[keyof typeof NestFlowIntents];
