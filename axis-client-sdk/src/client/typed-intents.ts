/**
 * Typed Intent Helpers for AXIS SDK
 * Provides type-safe wrappers for common intents
 */
import { AxisClient, IntentResult } from './axis-client';

// ============ Passport Intents ============

export interface PassportIssueParams {
  fullName: string;
  handle: string;
  stack?: string[];
  bio?: string;
}

export interface PassportIssueResult {
  passportId: string;
  handle: string;
}

export interface PassportRevokeParams {
  passportId: string;
  reason: string;
}

export interface PassportVerifyParams {
  passportId: string;
}

export interface PassportVerifyResult {
  valid: boolean;
  passportId: string;
  handle: string;
  trustLevel?: number;
}

// ============ Capsule Intents ============

export interface CapsuleCreateParams {
  allowedIntents: string[];
  scope?: {
    tenant?: string;
    hub?: string;
    realm?: string;
  };
  maxUsesPerMinute?: number;
  maxUsesPerHour?: number;
  maxUsesPerDay?: number;
  expiresAt?: string;
}

export interface CapsuleCreateResult {
  capsuleId: string;
  expiresAt: string;
}

export interface CapsuleRevokeParams {
  capsuleId: string;
  reason?: string;
}

// ============ File Intents ============

export interface FileInitParams {
  filename: string;
  size: number;
  chunkSize?: number;
  mime?: string;
}

export interface FileInitResult {
  fileId: string;
  chunkSize: number;
  totalChunks: number;
}

export interface FileStatusParams {
  fileId: string;
}

export interface FileStatusResult {
  fileId: string;
  filename: string;
  progress: number;
  receivedCount: number;
  totalChunks: number;
  missingChunks: number[];
  complete: boolean;
}

// ============ Stream Intents ============

export interface StreamPublishParams {
  topic: string;
  event: any;
}

export interface StreamReadParams {
  topic: string;
  fromOffset?: number;
  limit?: number;
}

export interface StreamReadResult {
  events: Array<{
    offset: number;
    timestamp: number;
    type: string;
    data: any;
  }>;
}

// ============ Catalog Intents ============

export interface CatalogSearchParams {
  query: string;
}

export interface CatalogDescribeParams {
  intent: string;
}

export interface CatalogCompleteParams {
  prefix: string;
}

/**
 * Typed Intent Helpers
 * Extends AxisClient with type-safe intent methods
 */
export class TypedAxisClient extends AxisClient {
  // Passport
  async passportIssue(
    params: PassportIssueParams,
  ): Promise<IntentResult<PassportIssueResult>> {
    return this.send<PassportIssueResult>('passport.issue', params);
  }

  async passportRevoke(
    params: PassportRevokeParams,
  ): Promise<IntentResult<void>> {
    return this.send<void>('passport.revoke', params);
  }

  async passportVerify(
    params: PassportVerifyParams,
  ): Promise<IntentResult<PassportVerifyResult>> {
    return this.send<PassportVerifyResult>('passport.verify', params);
  }

  // Capsules
  async capsuleCreate(
    params: CapsuleCreateParams,
  ): Promise<IntentResult<CapsuleCreateResult>> {
    return this.send<CapsuleCreateResult>('capsule.create', params);
  }

  async capsuleRevoke(
    params: CapsuleRevokeParams,
  ): Promise<IntentResult<void>> {
    return this.send<void>('capsule.revoke', params);
  }

  // Files
  async fileInit(
    params: FileInitParams,
  ): Promise<IntentResult<FileInitResult>> {
    return this.send<FileInitResult>('file.init', params);
  }

  async fileStatus(
    params: FileStatusParams,
  ): Promise<IntentResult<FileStatusResult>> {
    return this.send<FileStatusResult>('file.status', params);
  }

  async fileAbort(fileId: string): Promise<IntentResult<void>> {
    return this.send<void>('file.abort', { fileId });
  }

  // Streams
  async streamPublish(
    params: StreamPublishParams,
  ): Promise<IntentResult<void>> {
    return this.send<void>('stream.publish', params);
  }

  async streamRead(
    params: StreamReadParams,
  ): Promise<IntentResult<StreamReadResult>> {
    return this.send<StreamReadResult>('stream.read', params);
  }

  // Catalog
  async catalogSearch(query: string): Promise<IntentResult<string[]>> {
    return this.send<string[]>('catalog.search', { query });
  }

  async catalogDescribe(intent: string): Promise<IntentResult<any>> {
    return this.send<any>('catalog.intent.describe', { intent });
  }

  async catalogComplete(prefix: string): Promise<IntentResult<string[]>> {
    return this.send<string[]>('catalog.intent.complete', { prefix });
  }

  // ============ NestFlow Auth Intents ============

  async authWebLoginRequest(params: {
    browser_public_key: string;
    browser_key_algorithm?: string;
    browser_label?: string;
    requested_trust?: string;
  }): Promise<
    IntentResult<{
      login_challenge: {
        challenge_uid: string;
        status: string;
        expires_at: string;
      };
      tickauth_challenge: {
        challenge_uid: string;
        status: string;
        tick_window: { start: string; end: string };
      };
      qr_payload: Record<string, string>;
    }>
  > {
    return this.send('auth.web.login.request', params);
  }

  async authWebLoginScan(params: {
    login_challenge_uid: string;
    tickauth_challenge_uid: string;
    scanned_qr_hash?: string;
  }): Promise<
    IntentResult<{
      login_challenge: {
        challenge_uid: string;
        status: string;
        scanned_at: string;
      };
      display: {
        origin: string;
        browser_label?: string;
        requested_trust: string;
      };
    }>
  > {
    return this.send('auth.web.login.scan', params);
  }

  async sessionActivate(params: {
    login_challenge_uid: string;
    capsule_uid: string;
    browser_proof: {
      server_nonce: string;
      signature: string;
      signature_algorithm: string;
    };
  }): Promise<
    IntentResult<{
      session: {
        session_uid: string;
        status: string;
        issued_at: string;
        expires_at: string;
      };
      device: { device_uid: string; type: string; trust_level: string };
    }>
  > {
    return this.send('session.activate', params);
  }

  async sessionRefresh(params: {
    browser_proof?: {
      server_nonce: string;
      signature: string;
      signature_algorithm: string;
    };
  }): Promise<
    IntentResult<{
      session: { session_uid: string; status: string; expires_at: string };
    }>
  > {
    return this.send('session.refresh', params);
  }

  async sessionLogout(params: { reason?: string }): Promise<
    IntentResult<{
      session: { session_uid: string; status: string; revoked_reason?: string };
    }>
  > {
    return this.send('session.logout', params);
  }

  // ============ NestFlow Device Trust Intents ============

  async deviceTrustRequest(params: {
    target_device_uid: string;
    requested_trust: string;
    device_label?: string;
    browser_proof?: {
      server_nonce: string;
      signature: string;
      signature_algorithm: string;
    };
  }): Promise<
    IntentResult<{
      step_up_required: boolean;
      tickauth_challenge?: {
        challenge_uid: string;
        status: string;
        tick_window: { start: string; end: string };
      };
    }>
  > {
    return this.send('device.trust.request', params);
  }

  async deviceRevoke(params: {
    target_device_uid: string;
    reason?: string;
  }): Promise<
    IntentResult<{
      device: { device_uid: string; status: string; revoked_at: string };
      sessions_revoked: number;
      trust_links_revoked: number;
    }>
  > {
    return this.send('device.revoke', params);
  }

  async deviceList(): Promise<
    IntentResult<{
      devices: Array<{
        device_uid: string;
        name: string;
        type: string;
        trust_level: string;
        status: string;
        last_seen_at?: string;
      }>;
    }>
  > {
    return this.send('device.list', {});
  }
}

export default TypedAxisClient;
