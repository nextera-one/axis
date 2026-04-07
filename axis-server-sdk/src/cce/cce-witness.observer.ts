import { bytesToHex } from "@noble/hashes/utils.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
/**
 * CCE Witness Observer
 *
 * Records tamper-evident witness logs for every CCE request/response lifecycle.
 *
 * Redaction rules:
 * - Never store raw plaintext payloads (only hashes)
 * - Never store raw encryption keys
 * - Store verification outcomes, not raw crypto material
 */
import { randomBytes } from "crypto";

import { hashPayload } from "./cce-crypto";
import { CCE_DERIVATION, type CceCapsuleClaims, type CceRequestEnvelope, type CceResponseStatus, type CceWitnessRecord } from "./cce.types";

/**
 * Witness store interface — implementations persist witness records.
 */
export interface CceWitnessStore {
  record(witness: CceWitnessRecord): Promise<void>;
}

/**
 * In-memory witness store for development/testing.
 */
export class InMemoryCceWitnessStore implements CceWitnessStore {
  readonly records: CceWitnessRecord[] = [];

  async record(witness: CceWitnessRecord): Promise<void> {
    this.records.push(witness);
  }

  getByRequestId(requestId: string): CceWitnessRecord | undefined {
    return this.records.find((w) => w.request_id === requestId);
  }

  getByCapsuleId(capsuleId: string): CceWitnessRecord[] {
    return this.records.filter((w) => w.capsule_id === capsuleId);
  }
}

/**
 * Verification state accumulated during sensor chain execution.
 */
export interface CceVerificationState {
  clientSigVerified: boolean;
  capsuleSigVerified: boolean;
  tpsValid: boolean;
  audienceMatch: boolean;
  intentMatch: boolean;
  replayClean: boolean;
  nonceUnique: boolean;
  decryptionOk: boolean;
}

/**
 * Build a witness record from verification state and execution result.
 */
export function buildWitnessRecord(
  envelope: CceRequestEnvelope,
  capsule: CceCapsuleClaims,
  verification: CceVerificationState,
  execution: {
    status: CceResponseStatus;
    handlerDurationMs: number;
    effect?: string;
  },
  options: {
    axisLocalSecret: string;
    requestPayload?: Uint8Array;
    responsePayload?: Uint8Array;
    responseEncrypted: boolean;
  },
): CceWitnessRecord {
  // Generate witness ID
  const witnessId = generateWitnessId(envelope.request_id, capsule.capsule_id);

  // Compute execution context hash using HKDF witness derivation
  const executionContextHash = computeExecutionContextHash(
    options.axisLocalSecret,
    capsule,
    envelope.request_nonce,
  );

  return {
    witness_id: witnessId,
    request_id: envelope.request_id,
    capsule_id: capsule.capsule_id,
    sub: capsule.sub,
    intent: capsule.intent,
    aud: capsule.aud,
    tps_from: capsule.tps_from,
    tps_to: capsule.tps_to,
    timestamp: Math.floor(Date.now() / 1000),
    verification: {
      client_sig: verification.clientSigVerified,
      capsule_sig: verification.capsuleSigVerified,
      tps_valid: verification.tpsValid,
      audience_match: verification.audienceMatch,
      intent_match: verification.intentMatch,
      replay_clean: verification.replayClean,
      nonce_unique: verification.nonceUnique,
      decryption_ok: verification.decryptionOk,
    },
    execution: {
      status: execution.status,
      handler_duration_ms: execution.handlerDurationMs,
      ...(execution.effect ? { effect: execution.effect } : {}),
    },
    response_encrypted: options.responseEncrypted,
    execution_context_hash: executionContextHash,
    ...(options.requestPayload
      ? { request_payload_hash: hashPayload(options.requestPayload) }
      : {}),
    ...(options.responsePayload
      ? { response_payload_hash: hashPayload(options.responsePayload) }
      : {}),
  };
}

/**
 * Extract verification state from sensor chain metadata.
 */
export function extractVerificationState(
  metadata: Record<string, any>,
): CceVerificationState {
  return {
    clientSigVerified: metadata.cceClientSigVerified === true,
    capsuleSigVerified: metadata.cceCapsuleVerified === true,
    tpsValid: metadata.cceTpsValid === true,
    audienceMatch: metadata.cceBindingVerified === true,
    intentMatch: metadata.cceBindingVerified === true,
    replayClean: metadata.cceReplayClean === true,
    nonceUnique: metadata.cceReplayClean === true,
    decryptionOk: metadata.cceDecryptionOk === true,
  };
}

// ============================================================================
// Internal
// ============================================================================

function generateWitnessId(requestId: string, capsuleId: string): string {
  const input = `witness:${requestId}:${capsuleId}:${Date.now()}`;
  const hash = sha256(new TextEncoder().encode(input));
  return "wit_" + bytesToHex(hash).slice(0, 24);
}

function computeExecutionContextHash(
  axisLocalSecret: string,
  capsule: CceCapsuleClaims,
  requestNonce: string,
): string {
  const encoder = new TextEncoder();

  // Use HKDF to derive witness key
  const ikm = hexToBytes(axisLocalSecret);
  const salt = sha256(
    encoder.encode(
      capsule.capsule_id + "|" + capsule.capsule_nonce + "|" + requestNonce,
    ),
  );
  const info = encoder.encode(
    [
      CCE_DERIVATION.WITNESS,
      capsule.sub,
      capsule.kid,
      capsule.intent,
      capsule.aud,
      String(capsule.tps_from),
      String(capsule.tps_to),
      capsule.policy_hash ?? "",
      capsule.ver,
    ].join("|"),
  );

  const witnessKey = hkdf(sha256, ikm, salt, info, 32);
  const hash = bytesToHex(sha256(witnessKey));

  // Clear sensitive material
  witnessKey.fill(0);

  return hash;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
