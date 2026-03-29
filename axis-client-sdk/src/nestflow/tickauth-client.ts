import type { Signer } from '../signer';
import { NestFlowIntents } from './intents';
/**
 * NestFlow TickAuth Client
 *
 * Client-side helpers for TickAuth temporal authorization.
 * The mobile app uses these to:
 * - Build the canonical TickAuth fulfillment payload
 * - Sign the payload with the primary device key
 * - Construct the AXIS request for tickauth.challenge.fulfill
 */
import type { AxisRequest, QrPayload, TickAuthFulfillPayload, TickWindow } from './types';

/**
 * Build the canonical TickAuth fulfillment payload from a scanned QR payload.
 * The mobile app fills in the issuer device and identity info.
 */
export function buildTickAuthPayload(
  qr: QrPayload,
  issuerDeviceUid: string,
  identityUid: string,
  tpsCoordinate: string,
  tickWindow: TickWindow,
): TickAuthFulfillPayload {
  return {
    login_challenge_uid: qr.login_challenge_uid,
    tickauth_challenge_uid: qr.tickauth_challenge_uid,
    browser_public_key: qr.browser_public_key,
    nonce: qr.nonce,
    origin: qr.origin,
    issuer_device_uid: issuerDeviceUid,
    identity_uid: identityUid,
    tps_coordinate: tpsCoordinate,
    tick_window_start: tickWindow.start,
    tick_window_end: tickWindow.end,
  };
}

/**
 * Serialize a TickAuth payload to canonical JSON bytes for signing.
 * Keys are sorted to ensure deterministic serialization.
 */
export function canonicalizePayload(
  payload: TickAuthFulfillPayload,
): Uint8Array {
  const sorted = Object.keys(payload)
    .sort()
    .reduce<Record<string, string>>((acc, key) => {
      acc[key] = String((payload as unknown as Record<string, unknown>)[key]);
      return acc;
    }, {});
  return new TextEncoder().encode(JSON.stringify(sorted));
}

/**
 * Sign a TickAuth fulfillment payload with the device signer.
 * Returns the base64url-encoded signature.
 */
export async function signTickAuthPayload(
  payload: TickAuthFulfillPayload,
  signer: Signer,
): Promise<string> {
  const canonical = canonicalizePayload(payload);
  const signature = await signer.sign(canonical);
  return toBase64(signature);
}

/**
 * Build the complete AXIS request for tickauth.challenge.fulfill.
 * This is what the mobile app sends to the server after user approval.
 */
export async function buildTickAuthFulfillRequest(
  qr: QrPayload,
  issuerDeviceUid: string,
  identityUid: string,
  tpsCoordinate: string,
  tickWindow: TickWindow,
  signer: Signer,
): Promise<AxisRequest<TickAuthFulfillPayload & { signature: string }>> {
  const payload = buildTickAuthPayload(
    qr,
    issuerDeviceUid,
    identityUid,
    tpsCoordinate,
    tickWindow,
  );

  const signature = await signTickAuthPayload(payload, signer);
  const publicKey = await signer.getPublicKey();

  return {
    axis_version: '1.0',
    intent: NestFlowIntents.TICKAUTH_CHALLENGE_FULFILL,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: 'device',
      device_uid: issuerDeviceUid,
      identity_uid: identityUid,
      session_uid: null,
    },
    context: {
      origin: 'nestflow-key://mobile-app',
      tps_coordinate: tpsCoordinate,
    },
    payload: {
      ...payload,
      signature,
    },
    proof: {
      signature,
      signature_algorithm: 'ed25519',
      public_key: toBase64(publicKey),
      nonce: qr.nonce,
    },
  };
}

/**
 * Validate that the current time is within a tick window.
 */
export function isWithinTickWindow(tickWindow: TickWindow): boolean {
  const now = Date.now();
  const start = new Date(tickWindow.start).getTime();
  const end = new Date(tickWindow.end).getTime();
  return now >= start && now <= end;
}

/**
 * Create a tick window from now with the specified duration in milliseconds.
 */
export function createTickWindow(durationMs: number): TickWindow {
  const now = new Date();
  return {
    start: now.toISOString(),
    end: new Date(now.getTime() + durationMs).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Step-Up TickAuth
// ---------------------------------------------------------------------------

/**
 * Build a step-up TickAuth fulfillment request for protected actions.
 * Used when an action (e.g. flow.publish) requires elevated authorization.
 */
export async function buildStepUpFulfillRequest(
  tickauthChallengeUid: string,
  nonce: string,
  action: string,
  issuerDeviceUid: string,
  identityUid: string,
  tpsCoordinate: string,
  tickWindow: TickWindow,
  signer: Signer,
): Promise<AxisRequest> {
  const payload = {
    tickauth_challenge_uid: tickauthChallengeUid,
    nonce,
    requested_action: action,
    issuer_device_uid: issuerDeviceUid,
    identity_uid: identityUid,
    tps_coordinate: tpsCoordinate,
    tick_window_start: tickWindow.start,
    tick_window_end: tickWindow.end,
  };

  const canonical = new TextEncoder().encode(
    JSON.stringify(
      Object.keys(payload)
        .sort()
        .reduce<Record<string, string>>((acc, key) => {
          acc[key] = String(
            (payload as unknown as Record<string, unknown>)[key],
          );
          return acc;
        }, {}),
    ),
  );
  const signature = await signer.sign(canonical);
  const publicKey = await signer.getPublicKey();

  return {
    axis_version: '1.0',
    intent: NestFlowIntents.TICKAUTH_CHALLENGE_FULFILL,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: 'device',
      device_uid: issuerDeviceUid,
      identity_uid: identityUid,
      session_uid: null,
    },
    context: {
      origin: 'nestflow-key://mobile-app',
      tps_coordinate: tpsCoordinate,
    },
    payload: {
      ...payload,
      signature: toBase64(signature),
    },
    proof: {
      signature: toBase64(signature),
      signature_algorithm: 'ed25519',
      public_key: toBase64(publicKey),
      nonce,
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
