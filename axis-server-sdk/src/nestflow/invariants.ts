/**
 * AXIS NestFlow State Machine Invariants
 *
 * Validates state transitions for NestFlow entities.
 * Each entity has a defined lifecycle with valid transitions.
 *
 * @module nestflow/invariants
 */
import { CapsuleStatus, DeviceStatus, LoginChallengeStatus, SessionStatus, TickAuthChallengeStatus, TrustLinkStatus } from './types';

// ── Transition Maps ─────────────────────────────────────

const LOGIN_CHALLENGE_TRANSITIONS: Record<string, string[]> = {
  [LoginChallengeStatus.PENDING]: [
    LoginChallengeStatus.SCANNED,
    LoginChallengeStatus.EXPIRED,
  ],
  [LoginChallengeStatus.SCANNED]: [
    LoginChallengeStatus.APPROVED,
    LoginChallengeStatus.REJECTED,
    LoginChallengeStatus.EXPIRED,
  ],
  [LoginChallengeStatus.APPROVED]: [],
  [LoginChallengeStatus.REJECTED]: [],
  [LoginChallengeStatus.EXPIRED]: [],
};

const TICKAUTH_TRANSITIONS: Record<string, string[]> = {
  [TickAuthChallengeStatus.PENDING]: [
    TickAuthChallengeStatus.FULFILLED,
    TickAuthChallengeStatus.REJECTED,
    TickAuthChallengeStatus.EXPIRED,
  ],
  [TickAuthChallengeStatus.FULFILLED]: [],
  [TickAuthChallengeStatus.REJECTED]: [],
  [TickAuthChallengeStatus.EXPIRED]: [],
};

const CAPSULE_TRANSITIONS: Record<string, string[]> = {
  [CapsuleStatus.ACTIVE]: [
    CapsuleStatus.CONSUMED,
    CapsuleStatus.REVOKED,
    CapsuleStatus.EXPIRED,
  ],
  [CapsuleStatus.CONSUMED]: [],
  [CapsuleStatus.REVOKED]: [],
  [CapsuleStatus.EXPIRED]: [],
};

const SESSION_TRANSITIONS: Record<string, string[]> = {
  [SessionStatus.ACTIVE]: [SessionStatus.EXPIRED, SessionStatus.REVOKED],
  [SessionStatus.EXPIRED]: [],
  [SessionStatus.REVOKED]: [],
};

const DEVICE_TRANSITIONS: Record<string, string[]> = {
  [DeviceStatus.ACTIVE]: [DeviceStatus.SUSPENDED, DeviceStatus.REVOKED],
  [DeviceStatus.SUSPENDED]: [DeviceStatus.ACTIVE, DeviceStatus.REVOKED],
  [DeviceStatus.REVOKED]: [],
};

const TRUST_LINK_TRANSITIONS: Record<string, string[]> = {
  [TrustLinkStatus.ACTIVE]: [TrustLinkStatus.REVOKED],
  [TrustLinkStatus.REVOKED]: [],
};

// ── Validation Functions ────────────────────────────────

export interface TransitionResult {
  valid: boolean;
  reason?: string;
}

function checkTransition(
  entity: string,
  transitions: Record<string, string[]>,
  from: string,
  to: string,
): TransitionResult {
  const allowed = transitions[from];
  if (!allowed) {
    return {
      valid: false,
      reason: `${entity}: unknown current state '${from}'`,
    };
  }
  if (!allowed.includes(to)) {
    return {
      valid: false,
      reason: `${entity}: invalid transition '${from}' → '${to}'. Allowed: [${allowed.join(', ')}]`,
    };
  }
  return { valid: true };
}

export function validateLoginChallengeTransition(
  from: LoginChallengeStatus,
  to: LoginChallengeStatus,
): TransitionResult {
  return checkTransition(
    'LoginChallenge',
    LOGIN_CHALLENGE_TRANSITIONS,
    from,
    to,
  );
}

export function validateTickAuthTransition(
  from: TickAuthChallengeStatus,
  to: TickAuthChallengeStatus,
): TransitionResult {
  return checkTransition('TickAuthChallenge', TICKAUTH_TRANSITIONS, from, to);
}

export function validateCapsuleTransition(
  from: CapsuleStatus,
  to: CapsuleStatus,
): TransitionResult {
  return checkTransition('Capsule', CAPSULE_TRANSITIONS, from, to);
}

export function validateSessionTransition(
  from: SessionStatus,
  to: SessionStatus,
): TransitionResult {
  return checkTransition('Session', SESSION_TRANSITIONS, from, to);
}

export function validateDeviceTransition(
  from: DeviceStatus,
  to: DeviceStatus,
): TransitionResult {
  return checkTransition('Device', DEVICE_TRANSITIONS, from, to);
}

export function validateTrustLinkTransition(
  from: TrustLinkStatus,
  to: TrustLinkStatus,
): TransitionResult {
  return checkTransition('TrustLink', TRUST_LINK_TRANSITIONS, from, to);
}

// ── Terminal State Checks ───────────────────────────────

export function isLoginChallengeTerminal(
  status: LoginChallengeStatus,
): boolean {
  return [
    LoginChallengeStatus.APPROVED,
    LoginChallengeStatus.REJECTED,
    LoginChallengeStatus.EXPIRED,
  ].includes(status);
}

export function isTickAuthTerminal(status: TickAuthChallengeStatus): boolean {
  return [
    TickAuthChallengeStatus.FULFILLED,
    TickAuthChallengeStatus.REJECTED,
    TickAuthChallengeStatus.EXPIRED,
  ].includes(status);
}

export function isCapsuleTerminal(status: CapsuleStatus): boolean {
  return [
    CapsuleStatus.CONSUMED,
    CapsuleStatus.REVOKED,
    CapsuleStatus.EXPIRED,
  ].includes(status);
}

export function isSessionTerminal(status: SessionStatus): boolean {
  return [SessionStatus.EXPIRED, SessionStatus.REVOKED].includes(status);
}

export function isDeviceTerminal(status: DeviceStatus): boolean {
  return status === DeviceStatus.REVOKED;
}
