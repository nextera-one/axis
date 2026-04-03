import { AxisClient } from "./client/axis-client";
import type { IntentResult } from "./client/axis-client";
import { ed25519PublicKeyToSpki } from "./signer";
import type { Signer } from "./signer";
import { canonicalJson, toBase64Url } from "./utils/encoding";

export const AxisQrAuthIntents = {
  CHALLENGE: "axis.auth.qr.challenge",
  ATTACH_KEY: "axis.auth.qr.attach-key",
  APPROVE: "axis.auth.qr.approve",
  REJECT: "axis.auth.qr.reject",
  VERIFY: "axis.auth.qr.verify",
} as const;

export type AxisQrAuthIntent =
  (typeof AxisQrAuthIntents)[keyof typeof AxisQrAuthIntents];

export interface AxisQrChallengeRequest {
  origin?: string;
  ipAddress?: string;
  ttlSeconds?: number;
}

export interface AxisQrChallengeResponse {
  ok: true;
  challengeUid: string;
  nonce: string;
  expiresAt: number;
  qrPayload: string;
}

export interface AxisQrAttachKeyRequest {
  challengeUid: string;
  browserPublicKey: string;
  browserKeyAlgorithm: string;
  browserProofSignature: string;
  trustDeviceRequested?: boolean;
}

export interface AxisQrAttachKeyResponse {
  ok: true;
}

export interface AxisQrApprovalPayload {
  challengeUid: string;
  browserPublicKey: string;
  nonce: string;
  tickauthChallengeUid: string;
  expiresAt: number;
  actorId: string;
  approvedAt: number;
  scope?: string[];
}

export interface AxisQrApproveRequest {
  challengeUid: string;
  actorId: string;
  mobileDeviceUid: string;
  signedPayload: string;
  signature: string;
  scope?: string[];
}

export interface AxisQrApproveResponse {
  ok: true;
}

export interface AxisQrRejectRequest {
  challengeUid: string;
  actorId: string;
}

export interface AxisQrRejectResponse {
  ok: true;
}

export interface AxisQrVerifyRequest {
  challengeUid: string;
  browserPublicKey: string;
}

export type AxisQrVerifyResponse =
  | { ok: false; status: "pending" | "expired" | "rejected" }
  | {
      ok: true;
      status: "verified";
      actorId: string;
      deviceId: string;
      sessionUid: string;
      capsuleId: string;
      capsuleBytes: Uint8Array;
      intentSecret: string;
      expiresAt: number;
    };

export function buildAxisQrChallengeRequest(
  input: AxisQrChallengeRequest,
): AxisQrChallengeRequest {
  return { ...input };
}

export function buildAxisQrAttachKeyRequest(
  input: AxisQrAttachKeyRequest,
): AxisQrAttachKeyRequest {
  return { ...input, trustDeviceRequested: Boolean(input.trustDeviceRequested) };
}

export function buildAxisQrApproveRequest(
  input: AxisQrApproveRequest,
): AxisQrApproveRequest {
  return { ...input, scope: input.scope ?? [] };
}

export function buildAxisQrRejectRequest(
  input: AxisQrRejectRequest,
): AxisQrRejectRequest {
  return { ...input };
}

export function buildAxisQrVerifyRequest(
  input: AxisQrVerifyRequest,
): AxisQrVerifyRequest {
  return { ...input };
}

export function buildBrowserProofMessage(
  challengeUid: string,
  nonce: string,
): Uint8Array {
  return new TextEncoder().encode(`axis-qr-proof:${challengeUid}:${nonce}`);
}

export async function signBrowserProofMessage(
  challengeUid: string,
  nonce: string,
  signer: Signer,
): Promise<string> {
  return toBase64Url(
    await signer.sign(buildBrowserProofMessage(challengeUid, nonce)),
  );
}

export function ed25519PublicKeyToSpkiBase64Url(publicKey: Uint8Array): string {
  return toBase64Url(ed25519PublicKeyToSpki(publicKey));
}

export function buildQrApprovalPayload(
  input: AxisQrApprovalPayload,
): AxisQrApprovalPayload {
  return {
    ...input,
    scope: input.scope ?? [],
  };
}

export async function signQrApprovalPayload(
  payload: AxisQrApprovalPayload,
  signer: Signer,
): Promise<{ signedPayload: string; signature: string }> {
  const signedPayload = canonicalJson(payload);
  const signature = toBase64Url(
    await signer.sign(new TextEncoder().encode(signedPayload)),
  );
  return { signedPayload, signature };
}

export async function initiateAxisQrLogin(
  client: AxisClient,
  signer: Signer,
  input: AxisQrChallengeRequest & { trustDeviceRequested?: boolean } = {},
): Promise<{
  challenge: AxisQrChallengeResponse;
  attach: AxisQrAttachKeyResponse | undefined;
  browserPublicKey: string;
  browserProofSignature: string;
  qr: Record<string, unknown>;
}> {
  const challenge = await client.send<AxisQrChallengeResponse>(
    AxisQrAuthIntents.CHALLENGE,
    buildAxisQrChallengeRequest(input),
  );
  if (!challenge.ok || !challenge.data) {
    throw new Error(challenge.error || "QR challenge request failed");
  }

  const browserPublicKey = ed25519PublicKeyToSpkiBase64Url(
    await signer.getPublicKey(),
  );
  const browserProofSignature = await signBrowserProofMessage(
    challenge.data.challengeUid,
    challenge.data.nonce,
    signer,
  );

  const attach = await client.send<AxisQrAttachKeyResponse>(
    AxisQrAuthIntents.ATTACH_KEY,
    buildAxisQrAttachKeyRequest({
      challengeUid: challenge.data.challengeUid,
      browserPublicKey,
      browserKeyAlgorithm: signer.getAlg(),
      browserProofSignature,
      trustDeviceRequested: Boolean(input.trustDeviceRequested),
    }),
  );
  if (!attach.ok) {
    throw new Error(attach.error || "QR attach-key failed");
  }

  return {
    challenge: challenge.data,
    attach: attach.data,
    browserPublicKey,
    browserProofSignature,
    qr: parseQrPayload(challenge.data.qrPayload),
  };
}

export async function approveAxisQrLogin(
  client: AxisClient,
  input: {
    challengeUid: string;
    browserPublicKey: string;
    nonce: string;
    tickauthChallengeUid: string;
    expiresAt: number;
    actorId: string;
    mobileDeviceUid: string;
    signer: Signer;
    approvedAt?: number;
    scope?: string[];
  },
): Promise<IntentResult<AxisQrApproveResponse>> {
  const payload = buildQrApprovalPayload({
    challengeUid: input.challengeUid,
    browserPublicKey: input.browserPublicKey,
    nonce: input.nonce,
    tickauthChallengeUid: input.tickauthChallengeUid,
    expiresAt: input.expiresAt,
    actorId: input.actorId,
    approvedAt: input.approvedAt ?? Date.now(),
    scope: input.scope,
  });
  const { signedPayload, signature } = await signQrApprovalPayload(
    payload,
    input.signer,
  );

  return client.send<AxisQrApproveResponse>(
    AxisQrAuthIntents.APPROVE,
    buildAxisQrApproveRequest({
      challengeUid: input.challengeUid,
      actorId: input.actorId,
      mobileDeviceUid: input.mobileDeviceUid,
      signedPayload,
      signature,
      scope: input.scope,
    }),
  );
}

export async function waitForAxisQrVerification(
  client: AxisClient,
  input: AxisQrVerifyRequest,
  options: { pollIntervalMs?: number; timeoutMs?: number } = {},
): Promise<IntentResult<AxisQrVerifyResponse>> {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const result = await client.send<AxisQrVerifyResponse>(
      AxisQrAuthIntents.VERIFY,
      buildAxisQrVerifyRequest(input),
    );

    if (!result.ok || !result.data || result.data.status !== "pending") {
      return result;
    }

    await sleep(pollIntervalMs);
  }

  return {
    ok: false,
    error: "QR verification timed out",
  };
}

function parseQrPayload(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
