import { NESTFLOW_INTENTS } from './intents';
/**
 * AXIS NestFlow Intent Policy Map
 *
 * Maps each NestFlow intent to its required auth level.
 * This implements the security matrix from the NestFlow architecture spec.
 *
 * @module nestflow/policy-map
 */
import { AuthLevel } from './types';

/**
 * Required auth level for each NestFlow intent.
 *
 * Auth levels (ascending strictness):
 *   SESSION          → Valid session token
 *   SESSION_BROWSER  → Session + browser proof-of-possession
 *   STEP_UP          → Session + fresh TickAuth from primary device
 *   PRIMARY_DEVICE   → Must originate from primary device itself
 */
export const NESTFLOW_POLICY_MAP: Record<string, AuthLevel> = {
  // Auth — unauthenticated initiator (session issued after)
  [NESTFLOW_INTENTS.AUTH_WEB_LOGIN_REQUEST]: AuthLevel.SESSION,
  [NESTFLOW_INTENTS.AUTH_WEB_LOGIN_SCAN]: AuthLevel.PRIMARY_DEVICE,

  // TickAuth — primary device handles challenges
  [NESTFLOW_INTENTS.TICKAUTH_CHALLENGE_CREATE]: AuthLevel.SESSION,
  [NESTFLOW_INTENTS.TICKAUTH_CHALLENGE_FULFILL]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.TICKAUTH_CHALLENGE_REJECT]: AuthLevel.PRIMARY_DEVICE,

  // Capsule issuance — varies per type
  [NESTFLOW_INTENTS.CAPSULE_ISSUE_LOGIN]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.CAPSULE_ISSUE_DEVICE_REGISTRATION]:
    AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.CAPSULE_ISSUE_STEP_UP]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.CAPSULE_ISSUE_RECOVERY]: AuthLevel.PRIMARY_DEVICE,

  // Session management
  [NESTFLOW_INTENTS.SESSION_ACTIVATE]: AuthLevel.SESSION,
  [NESTFLOW_INTENTS.SESSION_REFRESH]: AuthLevel.SESSION_BROWSER,
  [NESTFLOW_INTENTS.SESSION_LOGOUT]: AuthLevel.SESSION,

  // Device trust management
  [NESTFLOW_INTENTS.DEVICE_TRUST_REQUEST]: AuthLevel.SESSION_BROWSER,
  [NESTFLOW_INTENTS.DEVICE_TRUST_PROMOTE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.DEVICE_REVOKE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.DEVICE_LIST]: AuthLevel.SESSION,
  [NESTFLOW_INTENTS.DEVICE_RENAME]: AuthLevel.SESSION_BROWSER,

  // Protected operations — require step-up auth
  [NESTFLOW_INTENTS.FLOW_PUBLISH]: AuthLevel.SESSION_BROWSER,
  [NESTFLOW_INTENTS.FLOW_DELETE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.NODE_DELETE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.SECRET_ROTATE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.ORG_SECURITY_UPDATE]: AuthLevel.STEP_UP,
  [NESTFLOW_INTENTS.PRODUCTION_EXECUTION_APPROVE]: AuthLevel.STEP_UP,

  // Recovery — highest privilege
  [NESTFLOW_INTENTS.IDENTITY_RECOVERY_START]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.IDENTITY_RECOVERY_COMPLETE]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.PRIMARY_DEVICE_ROTATE]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.IDENTITY_LOCK]: AuthLevel.PRIMARY_DEVICE,
  [NESTFLOW_INTENTS.IDENTITY_UNLOCK]: AuthLevel.PRIMARY_DEVICE,
};

/**
 * Returns the required auth level for an intent,
 * or undefined if the intent is not NestFlow-managed.
 */
export function getRequiredAuthLevel(intent: string): AuthLevel | undefined {
  return NESTFLOW_POLICY_MAP[intent];
}

/**
 * Checks if the provided auth level satisfies the requirement.
 * Auth levels ordered: SESSION < SESSION_BROWSER < STEP_UP < PRIMARY_DEVICE
 */
const AUTH_LEVEL_ORDER: AuthLevel[] = [
  AuthLevel.SESSION,
  AuthLevel.SESSION_BROWSER,
  AuthLevel.STEP_UP,
  AuthLevel.PRIMARY_DEVICE,
];

export function satisfiesAuthLevel(
  provided: AuthLevel,
  required: AuthLevel,
): boolean {
  const providedIdx = AUTH_LEVEL_ORDER.indexOf(provided);
  const requiredIdx = AUTH_LEVEL_ORDER.indexOf(required);
  return providedIdx >= requiredIdx;
}
