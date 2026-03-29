/**
 * AXIS NestFlow Server-Side Types
 *
 * Types for passwordless QR login, device trust hierarchy,
 * TickAuth temporal authorization, and session management.
 *
 * @module nestflow/types
 */

// ── Device ──────────────────────────────────────────────

export enum DeviceType {
  MOBILE = 'mobile',
  BROWSER = 'browser',
  CLI = 'cli',
  SERVICE = 'service',
}

export enum DeviceTrustLevel {
  PRIMARY = 'primary',
  TRUSTED = 'trusted',
  EPHEMERAL = 'ephemeral',
}

export enum DeviceStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended',
}

export interface DeviceRecord {
  device_uid: string;
  user_uid: string;
  name: string;
  type: DeviceType;
  trust_level: DeviceTrustLevel;
  status: DeviceStatus;
  public_key: string;
  key_algorithm: string;
  created_at: string;
  last_seen_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
}

// ── Login Challenge ─────────────────────────────────────

export enum LoginChallengeStatus {
  PENDING = 'pending',
  SCANNED = 'scanned',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface LoginChallengeRecord {
  challenge_uid: string;
  status: LoginChallengeStatus;
  browser_public_key: string;
  browser_key_algorithm: string;
  browser_label?: string;
  requested_trust: DeviceTrustLevel;
  origin?: string;
  qr_hash: string;
  created_at: string;
  expires_at: string;
  scanned_at?: string;
  scanned_by_device_uid?: string;
  approved_at?: string;
}

// ── TickAuth ────────────────────────────────────────────

export enum TickAuthChallengeStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface TickWindow {
  start: string;
  end: string;
}

export interface TickAuthChallengeRecord {
  challenge_uid: string;
  login_challenge_uid?: string;
  status: TickAuthChallengeStatus;
  tick_window: TickWindow;
  purpose: string;
  payload_hash?: string;
  fulfilled_at?: string;
  fulfilled_by_device_uid?: string;
}

// ── NestFlow Capsule ────────────────────────────────────

export enum NestFlowCapsuleType {
  LOGIN = 'login',
  DEVICE_REGISTRATION = 'device_registration',
  STEP_UP = 'step_up',
  RECOVERY = 'recovery',
}

export enum CapsuleStatus {
  ACTIVE = 'active',
  CONSUMED = 'consumed',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface NestFlowCapsuleScope {
  type: NestFlowCapsuleType;
  /** Intents this capsule authorizes */
  intents: string[];
  /** Device UID this capsule is bound to */
  device_uid?: string;
  /** Login challenge UID (for login capsules) */
  login_challenge_uid?: string;
}

// ── Session ─────────────────────────────────────────────

export enum SessionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export interface SessionRecord {
  session_uid: string;
  user_uid: string;
  device_uid: string;
  capsule_uid: string;
  status: SessionStatus;
  issued_at: string;
  expires_at: string;
  last_refreshed_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
}

// ── Device Trust Link ───────────────────────────────────

export enum TrustLinkType {
  LOGIN = 'login',
  PROMOTION = 'promotion',
  RECOVERY = 'recovery',
}

export enum TrustLinkStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

export interface DeviceTrustLinkRecord {
  link_uid: string;
  issuer_device_uid: string;
  target_device_uid: string;
  type: TrustLinkType;
  status: TrustLinkStatus;
  issued_at: string;
  revoked_at?: string;
}

// ── Auth Level (Intent Policy) ──────────────────────────

export enum AuthLevel {
  /** Basic session token */
  SESSION = 'session',
  /** Session + browser proof-of-possession */
  SESSION_BROWSER = 'session_browser',
  /** Session + fresh TickAuth step-up from primary device */
  STEP_UP = 'step_up',
  /** Must originate from primary device */
  PRIMARY_DEVICE = 'primary_device',
}

// ── Browser Proof ───────────────────────────────────────

export interface BrowserProof {
  server_nonce: string;
  signature: string;
  signature_algorithm: string;
}
