/**
 * NestFlow Passwordless QR Login — Core Types
 *
 * Implements the NestFlow Key architecture with:
 * - Device identity hierarchy (primary → trusted → ephemeral)
 * - QR login challenge lifecycle
 * - TickAuth temporal authorization
 * - Capsule-backed session issuance
 * - Browser proof-of-possession
 */

// ---------------------------------------------------------------------------
// Device
// ---------------------------------------------------------------------------

export enum DeviceType {
  MOBILE = 'mobile',
  WEB = 'web',
  DESKTOP = 'desktop',
}

export enum DeviceTrustLevel {
  PRIMARY = 'primary',
  TRUSTED = 'trusted',
  EPHEMERAL = 'ephemeral',
}

export enum DeviceStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface DeviceIdentity {
  deviceUid: string;
  name: string;
  type: DeviceType;
  platform?: string;
  trustLevel: DeviceTrustLevel;
  status: DeviceStatus;
  publicKey: string; // base64-encoded Ed25519 public key
  keyAlgorithm: string; // default 'ed25519'
  registeredByDeviceId?: string;
  createdAt: string; // ISO 8601
}

export interface DeviceRef {
  deviceUid: string;
  type: DeviceType;
  trustLevel: DeviceTrustLevel;
}

// ---------------------------------------------------------------------------
// Login Challenge
// ---------------------------------------------------------------------------

export enum LoginChallengeStatus {
  PENDING = 'pending',
  SCANNED = 'scanned',
  APPROVED = 'approved',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
  REJECTED = 'rejected',
}

export interface LoginChallenge {
  challengeUid: string;
  browserPublicKey: string;
  nonce: string;
  origin: string;
  status: LoginChallengeStatus;
  expiresAt: string; // ISO 8601
  scannedAt?: string;
  approvedAt?: string;
}

export interface QrPayload {
  login_challenge_uid: string;
  tickauth_challenge_uid: string;
  origin: string;
  browser_public_key: string;
  nonce: string;
  exp: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// TickAuth
// ---------------------------------------------------------------------------

export enum TickAuthChallengeStatus {
  PENDING = 'pending',
  FULFILLED = 'fulfilled',
  EXPIRED = 'expired',
  REJECTED = 'rejected',
}

export interface TickWindow {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface TickAuthChallenge {
  challengeUid: string;
  loginChallengeId: string;
  requestedAction: string;
  nonce: string;
  tickWindow: TickWindow;
  tpsCoordinate?: string;
  status: TickAuthChallengeStatus;
  expiresAt: string;
  fulfilledAt?: string;
}

export interface TickAuthFulfillPayload {
  login_challenge_uid: string;
  tickauth_challenge_uid: string;
  browser_public_key: string;
  nonce: string;
  origin: string;
  issuer_device_uid: string;
  identity_uid: string;
  tps_coordinate: string;
  tick_window_start: string;
  tick_window_end: string;
}

// ---------------------------------------------------------------------------
// Capsule Types (NestFlow extensions)
// ---------------------------------------------------------------------------

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
  action: string;
  trust?: string;
  target_device_uid?: string;
  target_flow_uid?: string;
}

export interface NestFlowCapsuleRef {
  capsuleUid: string;
  type: NestFlowCapsuleType;
  status: CapsuleStatus;
  validFrom: string;
  validUntil: string;
  scope?: NestFlowCapsuleScope;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export enum SessionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface NestFlowSession {
  sessionUid: string;
  identityUid: string;
  deviceUid: string;
  capsuleUid: string;
  status: SessionStatus;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt?: string;
}

export interface SessionRef {
  sessionUid: string;
}

// ---------------------------------------------------------------------------
// Device Trust Link
// ---------------------------------------------------------------------------

export enum TrustLinkType {
  EPHEMERAL_SESSION = 'ephemeral_session',
  TRUSTED_DEVICE = 'trusted_device',
  DELEGATED_DEVICE = 'delegated_device',
}

export enum TrustLinkStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export interface DeviceTrustLink {
  parentDeviceUid: string;
  childDeviceUid: string;
  capsuleUid: string;
  trustType: TrustLinkType;
  status: TrustLinkStatus;
  createdAt: string;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Auth Level (for policy enforcement)
// ---------------------------------------------------------------------------

export enum AuthLevel {
  SESSION = 'session',
  SESSION_BROWSER = 'session+browser',
  STEP_UP = 'step-up',
  PRIMARY_DEVICE = 'primary-device',
}

// ---------------------------------------------------------------------------
// Browser Proof
// ---------------------------------------------------------------------------

export interface BrowserProof {
  server_nonce: string;
  signature: string;
  signature_algorithm: string; // 'ed25519'
}

// ---------------------------------------------------------------------------
// AXIS Envelope Types (NestFlow JSON transport)
// ---------------------------------------------------------------------------

export interface AxisActor {
  type: 'anonymous' | 'device' | 'session' | 'system';
  device_uid: string | null;
  identity_uid: string | null;
  session_uid: string | null;
}

export interface AxisContext {
  origin: string;
  ip_address?: string | null;
  user_agent?: string | null;
  tps_coordinate?: string | null;
}

export interface AxisProof {
  signature: string | null;
  signature_algorithm: string | null;
  public_key: string | null;
  nonce: string | null;
}

export interface AxisRequest<T = unknown> {
  axis_version: string;
  intent: string;
  request_id: string;
  timestamp: string;
  actor: AxisActor;
  context: AxisContext;
  payload: T;
  proof: AxisProof;
}

export interface AxisReceipt {
  receipt_uid: string;
  issued_at: string;
  hash: string;
}

export interface AxisSuccessResponse<T = unknown> {
  ok: true;
  intent: string;
  request_id: string;
  result: T;
  receipt: AxisReceipt;
}

export interface AxisErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AxisErrorResponse {
  ok: false;
  intent: string;
  request_id: string;
  error: AxisErrorDetail;
  receipt: AxisReceipt;
}

export type AxisResponse<T = unknown> =
  | AxisSuccessResponse<T>
  | AxisErrorResponse;
