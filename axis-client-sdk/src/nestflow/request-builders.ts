import { NestFlowIntents } from "./intents";
import type { AxisRequest } from "./types";

export interface RequestActorContext {
  deviceUid: string;
  identityUid: string;
  origin?: string;
  sessionUid?: string;
}

export interface DeviceTrustPromotePayload {
  target_device_uid: string;
  label?: string;
}

export interface DeviceRenamePayload {
  target_device_uid: string;
  label: string;
}

export interface DeviceRevokePayload {
  target_device_uid: string;
  reason?: string;
}

export interface SessionRefreshPayload {
  reason?: string;
}

export interface SessionLogoutPayload {
  reason?: string;
}

export function buildDeviceTrustPromoteRequest(
  payload: DeviceTrustPromotePayload,
  actor: RequestActorContext,
): AxisRequest<DeviceTrustPromotePayload> {
  return makeDeviceRequest(
    NestFlowIntents.DEVICE_TRUST_PROMOTE,
    payload,
    actor,
  );
}

export function buildDeviceRenameRequest(
  payload: DeviceRenamePayload,
  actor: RequestActorContext,
): AxisRequest<DeviceRenamePayload> {
  return makeDeviceRequest(NestFlowIntents.DEVICE_RENAME, payload, actor);
}

export function buildDeviceRevokeRequest(
  payload: DeviceRevokePayload,
  actor: RequestActorContext,
): AxisRequest<DeviceRevokePayload> {
  return makeDeviceRequest(NestFlowIntents.DEVICE_REVOKE, payload, actor);
}

export function buildSessionRefreshRequest(
  payload: SessionRefreshPayload,
  actor: RequestActorContext,
): AxisRequest<SessionRefreshPayload> {
  return {
    axis_version: "1.0",
    intent: NestFlowIntents.SESSION_REFRESH,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: "session",
      device_uid: actor.deviceUid,
      identity_uid: actor.identityUid,
      session_uid: actor.sessionUid ?? null,
    },
    context: {
      origin: actor.origin ?? "nestflow-key://client-sdk",
    },
    payload,
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };
}

export function buildSessionLogoutRequest(
  payload: SessionLogoutPayload,
  actor: RequestActorContext,
): AxisRequest<SessionLogoutPayload> {
  return {
    axis_version: "1.0",
    intent: NestFlowIntents.SESSION_LOGOUT,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: "session",
      device_uid: actor.deviceUid,
      identity_uid: actor.identityUid,
      session_uid: actor.sessionUid ?? null,
    },
    context: {
      origin: actor.origin ?? "nestflow-key://client-sdk",
    },
    payload,
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };
}

function makeDeviceRequest<T>(
  intent: string,
  payload: T,
  actor: RequestActorContext,
): AxisRequest<T> {
  return {
    axis_version: "1.0",
    intent,
    request_id: `req_${generateId()}`,
    timestamp: new Date().toISOString(),
    actor: {
      type: "device",
      device_uid: actor.deviceUid,
      identity_uid: actor.identityUid,
      session_uid: actor.sessionUid ?? null,
    },
    context: {
      origin: actor.origin ?? "nestflow-key://client-sdk",
    },
    payload,
    proof: {
      signature: null,
      signature_algorithm: null,
      public_key: null,
      nonce: null,
    },
  };
}

function generateId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
