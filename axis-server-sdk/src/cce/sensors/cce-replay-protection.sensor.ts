/**
 * CCE Replay Protection Sensor
 *
 * Band: POLICY (order: 98)
 * Phase: POST_DECODE
 *
 * Steps 10-11 from CCE verification order:
 * 10. Verify capsule not replayed (capsule_id not consumed if SINGLE_USE)
 * 11. Verify request nonce uniqueness
 */
import type { AxisSensor, SensorDecision, SensorInput } from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import { CCE_ERROR, type CceCapsuleClaims, type CceRequestEnvelope } from "../cce.types";

/**
 * Replay store interface — implementations can use Redis, in-memory, etc.
 * Must support O(1) lookups for performance in the hot path.
 */
export interface CceReplayStore {
  /**
   * Check and mark a nonce/id as used.
   * @returns true if this is the first time (valid), false if replay
   */
  checkAndMark(key: string, ttlMs: number): Promise<boolean>;

  /** Check if a capsule has been consumed */
  isCapsuleConsumed(capsuleId: string): Promise<boolean>;

  /** Mark a capsule as consumed */
  markCapsuleConsumed(capsuleId: string, ttlMs: number): Promise<void>;

  /** Check if a capsule has been revoked */
  isCapsuleRevoked(capsuleId: string): Promise<boolean>;
}

/**
 * In-memory replay store for development/testing.
 */
export class InMemoryCceReplayStore implements CceReplayStore {
  private nonces = new Map<string, number>();
  private consumed = new Set<string>();
  private revoked = new Set<string>();

  async checkAndMark(key: string, ttlMs: number): Promise<boolean> {
    this.cleanup();
    if (this.nonces.has(key)) return false;
    this.nonces.set(key, Date.now() + ttlMs);
    return true;
  }

  async isCapsuleConsumed(capsuleId: string): Promise<boolean> {
    return this.consumed.has(capsuleId);
  }

  async markCapsuleConsumed(capsuleId: string, _ttlMs: number): Promise<void> {
    this.consumed.add(capsuleId);
  }

  async isCapsuleRevoked(capsuleId: string): Promise<boolean> {
    return this.revoked.has(capsuleId);
  }

  /** Revoke a capsule (for testing/admin) */
  revoke(capsuleId: string): void {
    this.revoked.add(capsuleId);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, expiresAt] of this.nonces) {
      if (expiresAt < now) this.nonces.delete(key);
    }
  }
}

export class CceReplayProtectionSensor implements AxisSensor {
  readonly name = "cce.replay.protection";
  readonly order = 98;
  readonly phase = "POST_DECODE" as const;

  /** Default nonce TTL: 5 minutes */
  private readonly nonceTtlMs: number;

  constructor(
    private readonly replayStore: CceReplayStore,
    options?: { nonceTtlMs?: number },
  ) {
    this.nonceTtlMs = options?.nonceTtlMs ?? 5 * 60 * 1000;
  }

  supports(input: SensorInput): boolean {
    return input.metadata?.cceCapsuleVerified === true;
  }

  async run(input: SensorInput): Promise<SensorDecision> {
    const capsule = input.metadata?.cceCapsule as CceCapsuleClaims | undefined;
    const envelope = input.metadata?.cceEnvelope as
      | CceRequestEnvelope
      | undefined;

    if (!capsule || !envelope) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.MISSING_CAPSULE],
        code: CCE_ERROR.MISSING_CAPSULE,
      };
    }

    // Check capsule revocation
    const revoked = await this.replayStore.isCapsuleRevoked(capsule.capsule_id);
    if (revoked) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.CAPSULE_REVOKED}: ${capsule.capsule_id}`],
        code: CCE_ERROR.CAPSULE_REVOKED,
      };
    }

    // Check capsule consumption (SINGLE_USE mode)
    if (capsule.mode === "SINGLE_USE") {
      const consumed = await this.replayStore.isCapsuleConsumed(
        capsule.capsule_id,
      );
      if (consumed) {
        return {
          allow: false,
          riskScore: 100,
          reasons: [`${CCE_ERROR.CAPSULE_CONSUMED}: ${capsule.capsule_id}`],
          code: CCE_ERROR.CAPSULE_CONSUMED,
        };
      }
    }

    // Check request nonce uniqueness
    // Namespace: sub + aud + intent to prevent cross-context collision
    const nonceKey = `cce:nonce:${capsule.sub}:${capsule.aud}:${capsule.intent}:${envelope.request_nonce}`;
    const nonceValid = await this.replayStore.checkAndMark(
      nonceKey,
      this.nonceTtlMs,
    );
    if (!nonceValid) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.NONCE_REUSED}: ${envelope.request_nonce.slice(0, 16)}...`,
        ],
        code: CCE_ERROR.NONCE_REUSED,
      };
    }

    // Mark capsule consumed for SINGLE_USE
    if (capsule.mode === "SINGLE_USE") {
      const capsuleTtl = (capsule.exp - capsule.iat) * 1000 + 60_000; // TTL + 1 min buffer
      await this.replayStore.markCapsuleConsumed(
        capsule.capsule_id,
        capsuleTtl,
      );
    }

    input.metadata = input.metadata ?? {};
    input.metadata.cceReplayClean = true;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
    };
  }
}
