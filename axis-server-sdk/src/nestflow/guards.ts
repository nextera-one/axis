import { getRequiredAuthLevel, satisfiesAuthLevel } from './policy-map';
/**
 * AXIS NestFlow Guards
 *
 * Server-side validation guards for NestFlow auth enforcement.
 * These are framework-agnostic validation functions that can be
 * used by NestJS guards, middleware, or standalone handlers.
 *
 * @module nestflow/guards
 */
import { AuthLevel, BrowserProof, CapsuleStatus, DeviceStatus, DeviceTrustLevel, LoginChallengeStatus, SessionStatus, TickAuthChallengeStatus } from './types';

// ── Guard Result ────────────────────────────────────────

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  /** If step-up is needed, the intent that requires it */
  step_up_intent?: string;
}

const allow = (): GuardResult => ({ allowed: true });
const deny = (reason: string): GuardResult => ({ allowed: false, reason });

// ── Intent Policy Guard ─────────────────────────────────

/**
 * Checks if the current auth context satisfies the intent's required auth level.
 */
export function checkIntentPolicy(
  intent: string,
  currentAuthLevel: AuthLevel,
): GuardResult {
  const required = getRequiredAuthLevel(intent);
  if (!required) {
    // Not a NestFlow-managed intent — defer to other auth mechanisms
    return allow();
  }

  if (satisfiesAuthLevel(currentAuthLevel, required)) {
    return allow();
  }

  return {
    allowed: false,
    reason: `Intent '${intent}' requires auth level '${required}', got '${currentAuthLevel}'`,
    step_up_intent: required === AuthLevel.STEP_UP ? intent : undefined,
  };
}

// ── Session Guard ───────────────────────────────────────

export interface SessionContext {
  session_uid: string;
  status: SessionStatus;
  expires_at: string;
  device_uid: string;
  user_uid: string;
}

/**
 * Validates a session is active and not expired.
 */
export function checkSession(session: SessionContext | null): GuardResult {
  if (!session) {
    return deny('No session found');
  }

  if (session.status !== SessionStatus.ACTIVE) {
    return deny(`Session status is '${session.status}', expected 'active'`);
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return deny('Session has expired');
  }

  return allow();
}

// ── Browser Proof Guard ─────────────────────────────────

/**
 * Validates a browser proof-of-possession is present and structurally valid.
 * Actual cryptographic verification must be done by the caller with the
 * browser's public key.
 */
export function checkBrowserProof(
  proof: BrowserProof | null | undefined,
  expectedNonce: string,
): GuardResult {
  if (!proof) {
    return deny('Browser proof-of-possession required but not provided');
  }

  if (!proof.server_nonce || !proof.signature || !proof.signature_algorithm) {
    return deny('Browser proof is missing required fields');
  }

  if (proof.server_nonce !== expectedNonce) {
    return deny('Browser proof nonce does not match expected server nonce');
  }

  return allow();
}

// ── Device Trust Guard ──────────────────────────────────

export interface DeviceContext {
  device_uid: string;
  trust_level: DeviceTrustLevel;
  status: DeviceStatus;
}

/**
 * Checks if a device meets a minimum trust level requirement.
 */
const TRUST_ORDER: DeviceTrustLevel[] = [
  DeviceTrustLevel.EPHEMERAL,
  DeviceTrustLevel.TRUSTED,
  DeviceTrustLevel.PRIMARY,
];

export function checkDeviceTrust(
  device: DeviceContext | null,
  minimumTrust: DeviceTrustLevel,
): GuardResult {
  if (!device) {
    return deny('Device not found');
  }

  if (device.status !== DeviceStatus.ACTIVE) {
    return deny(`Device status is '${device.status}', expected 'active'`);
  }

  const deviceIdx = TRUST_ORDER.indexOf(device.trust_level);
  const requiredIdx = TRUST_ORDER.indexOf(minimumTrust);

  if (deviceIdx < requiredIdx) {
    return deny(
      `Device trust level '${device.trust_level}' does not meet minimum '${minimumTrust}'`,
    );
  }

  return allow();
}

// ── Capsule Guard ───────────────────────────────────────

export interface CapsuleContext {
  capsule_uid: string;
  status: CapsuleStatus;
  type: string;
  intents: string[];
  device_uid?: string;
  expires_at: string;
}

/**
 * Validates a NestFlow capsule for a given intent.
 */
export function checkCapsule(
  capsule: CapsuleContext | null,
  intent: string,
  requestingDeviceUid?: string,
): GuardResult {
  if (!capsule) {
    return deny('Capsule not found');
  }

  if (capsule.status !== CapsuleStatus.ACTIVE) {
    return deny(`Capsule status is '${capsule.status}', expected 'active'`);
  }

  if (new Date(capsule.expires_at).getTime() < Date.now()) {
    return deny('Capsule has expired');
  }

  // Check intent authorization
  const intentAllowed = capsule.intents.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern === intent) return true;
    if (pattern.endsWith('.*')) {
      return intent.startsWith(pattern.slice(0, -1));
    }
    return false;
  });

  if (!intentAllowed) {
    return deny(`Capsule does not authorize intent '${intent}'`);
  }

  // If capsule is device-bound, check device matches
  if (
    capsule.device_uid &&
    requestingDeviceUid &&
    capsule.device_uid !== requestingDeviceUid
  ) {
    return deny('Capsule is bound to a different device');
  }

  return allow();
}

// ── Login Challenge State Guard ─────────────────────────

export interface LoginChallengeContext {
  challenge_uid: string;
  status: LoginChallengeStatus;
  expires_at: string;
}

/**
 * Validates a login challenge is in the expected state.
 */
export function checkLoginChallenge(
  challenge: LoginChallengeContext | null,
  expectedStatus: LoginChallengeStatus,
): GuardResult {
  if (!challenge) {
    return deny('Login challenge not found');
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return deny('Login challenge has expired');
  }

  if (challenge.status !== expectedStatus) {
    return deny(
      `Login challenge status is '${challenge.status}', expected '${expectedStatus}'`,
    );
  }

  return allow();
}

// ── TickAuth Guard ──────────────────────────────────────

export interface TickAuthContext {
  challenge_uid: string;
  status: TickAuthChallengeStatus;
  tick_window: { start: string; end: string };
}

/**
 * Validates a TickAuth challenge is pending and within its tick window.
 */
export function checkTickAuth(challenge: TickAuthContext | null): GuardResult {
  if (!challenge) {
    return deny('TickAuth challenge not found');
  }

  if (challenge.status !== TickAuthChallengeStatus.PENDING) {
    return deny(
      `TickAuth challenge status is '${challenge.status}', expected 'pending'`,
    );
  }

  const now = Date.now();
  const start = new Date(challenge.tick_window.start).getTime();
  const end = new Date(challenge.tick_window.end).getTime();

  if (now < start || now > end) {
    return deny('TickAuth challenge is outside its tick window');
  }

  return allow();
}

// ── Replay Protection ───────────────────────────────────

/**
 * Interface for a nonce store — implementations must handle persistence.
 */
export interface NonceStore {
  /** Returns true if the nonce has been seen before */
  has(nonce: string): Promise<boolean>;
  /** Records the nonce as used */
  add(nonce: string, expiresAt: Date): Promise<void>;
}

/**
 * Checks a nonce against a replay store.
 */
export async function checkReplayProtection(
  nonce: string,
  store: NonceStore,
  windowMs: number = 5 * 60 * 1000,
): Promise<GuardResult> {
  if (!nonce) {
    return deny('Nonce is required for replay protection');
  }

  const seen = await store.has(nonce);
  if (seen) {
    return deny('Nonce has already been used (replay detected)');
  }

  await store.add(nonce, new Date(Date.now() + windowMs));
  return allow();
}
