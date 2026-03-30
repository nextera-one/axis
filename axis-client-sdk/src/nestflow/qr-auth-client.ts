import type { IntentResult } from "../client/axis-client";
import type { AxisClient } from "../client/axis-client";
import { exportSignerPublicKeySpkiBase64Url, type Signer } from "../signer";
import { ed25519PublicKeyToSpki } from "../signer";

export const AxisQrAuthIntents = {
  CHALLENGE: "axis.auth.qr.challenge",
  ATTACH_KEY: "axis.auth.qr.attach-key",
  APPROVE: "axis.auth.qr.approve",
  REJECT: "axis.auth.qr.reject",
  VERIFY: "axis.auth.qr.verify",
} as const;

export interface AxisQrChallengeRequestInput {
  origin?: string;
  ipAddress?: string;
  ttlSeconds?: number;
}

export interface AxisQrAttachKeyInput {
  challengeUid: string;
  browserPublicKey: string;
  browserKeyAlgorithm: string;
  browserProofSignature: string;
  trustDeviceRequested?: boolean;
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

export interface AxisQrApproveInput {
  challengeUid: string;
  actorId: string;
  mobileDeviceUid: string;
  signedPayload: string;
  signature: string;
  scope?: string[];
}

export interface AxisQrRejectInput {
  challengeUid: string;
  actorId: string;
}

export interface AxisQrVerifyInput {
  challengeUid: string;
  browserPublicKey: string;
}

export interface AxisQrChallengeResponse {
  ok: true;
  challengeUid: string;
  nonce: string;
  expiresAt: number;
  qrPayload: string;
}

export interface AxisQrBackendPayload {
  v: number;
  challengeUid: string;
  tickAuthChallengeUid: string;
  nonce: string;
  origin: string | null;
  tickWindowStart: number;
  tickWindowEnd: number;
  expiresAt: number;
}

export interface AxisQrAttachKeyResponse {
  ok: true;
}

export interface AxisQrApproveResult {
  signedPayload: string;
  signature: string;
  response: unknown;
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
      capsuleBytes: unknown;
      intentSecret: string;
      expiresAt: number;
    };

export interface InitiateAxisQrLoginOptions {
  origin?: string;
  ipAddress?: string;
  ttlSeconds?: number;
  trustDeviceRequested?: boolean;
}

export interface InitiatedAxisQrLogin {
  challenge: AxisQrChallengeResponse;
  qr: AxisQrBackendPayload;
  browserPublicKey: string;
  browserKeyAlgorithm: string;
  browserProofSignature: string;
}

export interface ApproveAxisQrLoginOptions {
  challengeUid: string;
  browserPublicKey: string;
  nonce: string;
  tickAuthChallengeUid: string;
  expiresAt: number;
  actorId: string;
  mobileDeviceUid: string;
  signer: Signer;
  scope?: string[];
}

export interface WaitForAxisQrVerificationOptions {
  challengeUid: string;
  browserPublicKey: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export function buildAxisQrChallengeRequest(
  input: AxisQrChallengeRequestInput,
): AxisQrChallengeRequestInput {
  return input;
}

export function buildAxisQrAttachKeyRequest(
  input: AxisQrAttachKeyInput,
): AxisQrAttachKeyInput {
  return input;
}

export function buildAxisQrApproveRequest(
  input: AxisQrApproveInput,
): AxisQrApproveInput {
  return input;
}

export function buildAxisQrRejectRequest(
  input: AxisQrRejectInput,
): AxisQrRejectInput {
  return input;
}

export function buildAxisQrVerifyRequest(
  input: AxisQrVerifyInput,
): AxisQrVerifyInput {
  return input;
}

export function buildQrApprovalPayload(
  payload: AxisQrApprovalPayload,
): AxisQrApprovalPayload {
  return payload;
}

export function parseAxisQrBackendPayload(raw: string): AxisQrBackendPayload {
  const parsed = JSON.parse(raw);

  if (
    typeof parsed.challengeUid !== "string" ||
    typeof parsed.tickAuthChallengeUid !== "string" ||
    typeof parsed.nonce !== "string" ||
    typeof parsed.expiresAt !== "number"
  ) {
    throw new Error("Invalid backend QR payload");
  }

  return {
    v: Number(parsed.v ?? 1),
    challengeUid: parsed.challengeUid,
    tickAuthChallengeUid: parsed.tickAuthChallengeUid,
    nonce: parsed.nonce,
    origin: parsed.origin ?? null,
    tickWindowStart: Number(parsed.tickWindowStart ?? 0),
    tickWindowEnd: Number(parsed.tickWindowEnd ?? 0),
    expiresAt: Number(parsed.expiresAt),
  };
}

export function canonicalizeQrApprovalPayload(
  payload: AxisQrApprovalPayload,
): string {
  return JSON.stringify(sortKeys(payload));
}

export async function signQrApprovalPayload(
  payload: AxisQrApprovalPayload,
  signer: Signer,
): Promise<{ signedPayload: string; signature: string }> {
  const signedPayload = canonicalizeQrApprovalPayload(payload);
  const signature = await signer.sign(new TextEncoder().encode(signedPayload));
  return {
    signedPayload,
    signature: toBase64Url(signature),
  };
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
  const signature = await signer.sign(
    buildBrowserProofMessage(challengeUid, nonce),
  );
  return toBase64Url(signature);
}

export async function createAxisQrAttachKeyInput(
  challengeUid: string,
  nonce: string,
  signer: Signer,
  trustDeviceRequested: boolean = false,
): Promise<AxisQrAttachKeyInput> {
  return {
    challengeUid,
    browserPublicKey: await exportSignerPublicKeySpkiBase64Url(signer),
    browserKeyAlgorithm: signer.getAlg(),
    browserProofSignature: await signBrowserProofMessage(
      challengeUid,
      nonce,
      signer,
    ),
    trustDeviceRequested,
  };
}

export async function initiateAxisQrLogin(
  client: AxisClient,
  browserSigner: Signer,
  options: InitiateAxisQrLoginOptions = {},
): Promise<InitiatedAxisQrLogin> {
  const challengeResult = await client.send<AxisQrChallengeResponse>(
    AxisQrAuthIntents.CHALLENGE,
    buildAxisQrChallengeRequest({
      origin: options.origin,
      ipAddress: options.ipAddress,
      ttlSeconds: options.ttlSeconds,
    }),
  );
  const challenge = unwrapIntentResult(
    challengeResult,
    "Failed to create QR challenge",
  );
  const attachInput = await createAxisQrAttachKeyInput(
    challenge.challengeUid,
    challenge.nonce,
    browserSigner,
    options.trustDeviceRequested ?? false,
  );

  const attachResult = await client.send<AxisQrAttachKeyResponse>(
    AxisQrAuthIntents.ATTACH_KEY,
    buildAxisQrAttachKeyRequest(attachInput),
  );
  unwrapIntentResult(
    attachResult,
    "Failed to attach browser key to QR challenge",
  );

  return {
    challenge,
    qr: parseAxisQrBackendPayload(challenge.qrPayload),
    browserPublicKey: attachInput.browserPublicKey,
    browserKeyAlgorithm: attachInput.browserKeyAlgorithm,
    browserProofSignature: attachInput.browserProofSignature,
  };
}

export async function approveAxisQrLogin(
  client: AxisClient,
  options: ApproveAxisQrLoginOptions,
): Promise<AxisQrApproveResult> {
  const approvalPayload = buildQrApprovalPayload({
    challengeUid: options.challengeUid,
    browserPublicKey: options.browserPublicKey,
    nonce: options.nonce,
    tickauthChallengeUid: options.tickAuthChallengeUid,
    expiresAt: options.expiresAt,
    actorId: options.actorId,
    approvedAt: Date.now(),
    scope: options.scope,
  });
  const { signedPayload, signature } = await signQrApprovalPayload(
    approvalPayload,
    options.signer,
  );
  const response = await client.send(
    AxisQrAuthIntents.APPROVE,
    buildAxisQrApproveRequest({
      challengeUid: options.challengeUid,
      actorId: options.actorId,
      mobileDeviceUid: options.mobileDeviceUid,
      signedPayload,
      signature,
      scope: options.scope,
    }),
  );

  return {
    signedPayload,
    signature,
    response: unwrapIntentResult(response, "Failed to approve QR challenge"),
  };
}

export async function rejectAxisQrLogin(
  client: AxisClient,
  input: AxisQrRejectInput,
): Promise<unknown> {
  const response = await client.send(
    AxisQrAuthIntents.REJECT,
    buildAxisQrRejectRequest(input),
  );
  return unwrapIntentResult(response, "Failed to reject QR challenge");
}

export async function verifyAxisQrLogin(
  client: AxisClient,
  input: AxisQrVerifyInput,
): Promise<AxisQrVerifyResponse> {
  const response = await client.send<AxisQrVerifyResponse>(
    AxisQrAuthIntents.VERIFY,
    buildAxisQrVerifyRequest(input),
  );
  return unwrapIntentResult(response, "Failed to verify QR challenge");
}

export async function waitForAxisQrVerification(
  client: AxisClient,
  options: WaitForAxisQrVerificationOptions,
): Promise<Extract<AxisQrVerifyResponse, { ok: true }>> {
  const pollIntervalMs = options.pollIntervalMs ?? 1500;
  const timeoutMs = options.timeoutMs ?? 120000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await verifyAxisQrLogin(client, {
      challengeUid: options.challengeUid,
      browserPublicKey: options.browserPublicKey,
    });

    if (response.ok) {
      return response;
    }

    if (response.status === "expired" || response.status === "rejected") {
      throw new Error(`QR challenge ${response.status}`);
    }

    await delay(pollIntervalMs);
  }

  throw new Error("Timed out waiting for QR challenge verification");
}

export function ed25519PublicKeyToSpkiBase64Url(publicKey: Uint8Array): string {
  return toBase64Url(ed25519PublicKeyToSpki(publicKey));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function unwrapIntentResult<T>(
  result: IntentResult<T>,
  fallbackMessage: string,
): T {
  if (!result.ok || result.data === undefined) {
    throw new Error(result.error ?? fallbackMessage);
  }

  return result.data;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
