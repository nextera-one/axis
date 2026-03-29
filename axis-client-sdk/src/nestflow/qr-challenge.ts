import { type DeviceKeyPair, generateDeviceKeyPair } from './device-identity';
import { NestFlowIntents } from './intents';
/**
 * NestFlow QR Login Challenge
 *
 * Handles the QR flow for passwordless web login:
 * 1. Browser generates keypair and requests login challenge
 * 2. Server creates challenge + TickAuth challenge → returns QR payload
 * 3. Mobile scans QR, verifies, and approves
 * 4. Browser proves possession and activates session
 */
import type { AxisActor, AxisContext, AxisProof, AxisRequest, BrowserProof, QrPayload } from './types';

/** Options for initiating a web login request */
export interface WebLoginRequestOptions {
  origin: string;
  userAgent?: string;
  browserLabel?: string;
  requestedTrust?: 'ephemeral_session' | 'trusted_device';
}

/** Result of initiating a web login */
export interface WebLoginRequestResult {
  browserKeyPair: DeviceKeyPair;
  browserPublicKeyBase64: string;
  request: AxisRequest<{
    browser_public_key: string;
    browser_key_algorithm: string;
    browser_label?: string;
    requested_trust: string;
  }>;
}

/**
 * Prepare a web login request.
 * Generates a fresh browser keypair and builds the AXIS request envelope.
 */
export async function prepareWebLoginRequest(
  opts: WebLoginRequestOptions,
): Promise<WebLoginRequestResult> {
  const browserKeyPair = await generateDeviceKeyPair();
  const browserPublicKeyBase64 = toBase64(browserKeyPair.publicKey);

  const request: AxisRequest<{
    browser_public_key: string;
    browser_key_algorithm: string;
    browser_label?: string;
    requested_trust: string;
  }> = {
    axis_version: '1.0',
    intent: NestFlowIntents.AUTH_WEB_LOGIN_REQUEST,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: 'anonymous',
      device_uid: null,
      identity_uid: null,
      session_uid: null,
    },
    context: {
      origin: opts.origin,
      user_agent: opts.userAgent ?? null,
    },
    payload: {
      browser_public_key: browserPublicKeyBase64,
      browser_key_algorithm: 'ed25519',
      browser_label: opts.browserLabel,
      requested_trust: opts.requestedTrust ?? 'ephemeral_session',
    },
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };

  return { browserKeyPair, browserPublicKeyBase64, request };
}

/**
 * Parse a QR payload from a scanned QR code.
 * The mobile app uses this to extract the login challenge details.
 */
export function parseQrPayload(raw: string): QrPayload {
  const parsed = JSON.parse(raw);

  if (
    !parsed.login_challenge_uid ||
    !parsed.tickauth_challenge_uid ||
    !parsed.origin ||
    !parsed.browser_public_key ||
    !parsed.nonce ||
    !parsed.exp
  ) {
    throw new Error('Invalid QR payload: missing required fields');
  }

  return {
    login_challenge_uid: String(parsed.login_challenge_uid),
    tickauth_challenge_uid: String(parsed.tickauth_challenge_uid),
    origin: String(parsed.origin),
    browser_public_key: String(parsed.browser_public_key),
    nonce: String(parsed.nonce),
    exp: String(parsed.exp),
  };
}

/**
 * Check whether a QR payload has expired.
 */
export function isQrPayloadExpired(qr: QrPayload): boolean {
  return new Date(qr.exp).getTime() < Date.now();
}

/**
 * Build the scan announcement request (sent by mobile after scanning QR).
 */
export function buildScanRequest(
  qr: QrPayload,
  deviceUid: string,
): AxisRequest<{
  login_challenge_uid: string;
  tickauth_challenge_uid: string;
  scanned_qr_hash: string;
}> {
  return {
    axis_version: '1.0',
    intent: NestFlowIntents.AUTH_WEB_LOGIN_SCAN,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: 'device',
      device_uid: deviceUid,
      identity_uid: null,
      session_uid: null,
    },
    context: {
      origin: 'nestflow-key://mobile-app',
    },
    payload: {
      login_challenge_uid: qr.login_challenge_uid,
      tickauth_challenge_uid: qr.tickauth_challenge_uid,
      scanned_qr_hash: '', // computed on send
    },
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Browser Proof-of-Possession
// ---------------------------------------------------------------------------

/**
 * Create a browser proof by signing a server nonce with the browser's private key.
 * This proves the browser actually holds the private key matching the public key
 * that was included in the QR login challenge.
 */
export async function createBrowserProof(
  browserPrivateKey: Uint8Array,
  serverNonce: string,
): Promise<BrowserProof> {
  const { Ed25519Signer } = await import('../signer/index.js');
  const signer = new Ed25519Signer(browserPrivateKey);

  const message = new TextEncoder().encode(serverNonce);
  const signature = await signer.sign(message);

  return {
    server_nonce: serverNonce,
    signature: toBase64(signature),
    signature_algorithm: 'ed25519',
  };
}

/**
 * Build a session activation request with browser proof.
 */
export function buildSessionActivateRequest(
  loginChallengeUid: string,
  capsuleUid: string,
  browserProof: BrowserProof,
  origin: string,
): AxisRequest<{
  login_challenge_uid: string;
  capsule_uid: string;
  browser_proof: BrowserProof;
}> {
  return {
    axis_version: '1.0',
    intent: NestFlowIntents.SESSION_ACTIVATE,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: 'anonymous',
      device_uid: null,
      identity_uid: null,
      session_uid: null,
    },
    context: {
      origin,
    },
    payload: {
      login_challenge_uid: loginChallengeUid,
      capsule_uid: capsuleUid,
      browser_proof: browserProof,
    },
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(bytes: Uint8Array): string {
  const binStr = String.fromCharCode(...bytes);
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
