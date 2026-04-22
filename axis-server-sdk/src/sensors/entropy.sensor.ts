import * as crypto from "crypto";

import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";

import { TLV_NONCE, TLV_PID } from "../core/constants";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Entropy AxisSensor - Randomness Quality Analysis
 *
 * Validates that cryptographic identifiers (PIDs, nonces) have sufficient
 * randomness to prevent predictability attacks. Weak entropy in IDs can
 * lead to collision attacks and session hijacking.
 *
 * **Execution Order:** 130 (after replay protection, before policy checks)
 *
 * **Core Concept:**
 * Proper cryptographic security requires high-quality randomness. This sensor
 * detects patterns that suggest weak random number generation:
 * - Low Shannon entropy
 * - Sequential patterns (1,2,3,4...)
 * - Repeated patterns (0xAB,0xAB,0xAB...)
 *
 * **How It Works:**
 * ```
 * 1. Extract PID and nonce from headers
 * 2. Calculate Shannon entropy for each
 * 3. Check for sequential patterns
 * 4. Check for repeated patterns
 * 5. FLAG if issues found (doesn't DENY for availability)
 * ```
 *
 * **Shannon Entropy Calculation:**
 * ```
 * H = -Σ(p_i * log2(p_i))
 * ```
 * Where p_i is the probability of byte value i appearing.
 * - High entropy (7-8 bits/byte): Good randomness
 * - Low entropy (<3 bits/byte): Suspicious pattern
 *
 * **Pattern Detection:**
 * - **Sequential:** More than 50% of bytes are +1 or -1 from previous
 * - **Repeated:** 90%+ match with 2, 4, or 8 byte repeating pattern
 *
 * **Security Model:**
 * - **Fail Open:** Issues cause FLAG, not DENY
 * - **Trust Score Impact:** Each issue reduces trust score
 * - **Detection Only:** Logs suspicious patterns for investigation
 *
 * **Actions:**
 * - `ALLOW` - Sufficient entropy, no patterns detected
 * - `FLAG` - Issues detected (reduces trust score)
 *
 * **Score Deltas:**
 * | Issue | Delta |
 * |-------|-------|
 * | Low entropy (<3 bits/byte) | -3 |
 * | Sequential pattern | -5 |
 * | Repeated pattern | -5 |
 *
 * **Why Not DENY?**
 * Legitimate clients with older RNG libraries might trigger false positives.
 * FLAG allows monitoring without breaking legitimate traffic.
 *
 * **Performance:**
 * - In-memory analysis
 * - O(n) where n = bytes analyzed
 * - Latency: <1ms
 *
 * @class EntropySensor
 * @implements {AxisSensor}
 * @implements {OnModuleInit}
 *
 * @example
 * High-entropy nonce (good):
 * ```typescript
 * // Nonce from crypto.randomBytes(16)
 * // Entropy: 7.2 bits/byte
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Sequential pattern (suspicious):
 * ```typescript
 * // Nonce: [1,2,3,4,5,6,7,8,9,10,11,12]
 * {
 *   action: 'FLAG',
 *   scoreDelta: -5,
 *   reasons: ['nonce_sequential']
 * }
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Entropy_(information_theory) Shannon Entropy}
 */
@Sensor()
export class EntropySensor implements AxisSensor {
  private readonly logger = {
    warn: (msg: string) => console.warn(`[EntropySensor] ${msg}`),
  };

  /**
   * Minimum acceptable entropy in bits per byte.
   *
   * 3.0 bits/byte is a conservative threshold:
   * - Random data: ~7.9 bits/byte
   * - English text: ~4.5 bits/byte
   * - Sequential data: ~0-2 bits/byte
   */
  private readonly MIN_ENTROPY_THRESHOLD = 3.0;

  /** AxisSensor identifier */
  readonly name = "EntropySensor";

  /**
   * Execution order - anomaly detection phase
   *
   * Order 130 ensures:
   * - Replay protection done (120)
   * - Runs before expensive policy lookups
   */
  readonly order = BAND.POLICY + 35;

  /**
   * Calculates Shannon entropy of a byte array.
   *
   * **Algorithm:**
   * 1. Count frequency of each byte value (0-255)
   * 2. Calculate probability p = count / total
   * 3. Sum: -Σ(p * log2(p))
   *
   * @private
   * @param {Uint8Array} data - Bytes to analyze
   * @returns {number} Entropy in bits per byte (0-8 scale)
   */
  private calculateEntropy(data: Uint8Array): number {
    if (data.length === 0) return 0;

    // Count byte frequencies
    const freq = new Map<number, number>();
    for (const byte of data) {
      freq.set(byte, (freq.get(byte) || 0) + 1);
    }

    // Calculate Shannon entropy
    let entropy = 0;
    const len = data.length;
    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Checks for sequential patterns in data.
   *
   * Detects sequences like [1,2,3,4...] or [10,9,8,7...].
   * More than 50% sequential is considered suspicious.
   *
   * @private
   * @param {Uint8Array} data - Bytes to analyze
   * @returns {boolean} True if sequential pattern detected
   */
  private hasSequentialPattern(data: Uint8Array): boolean {
    if (data.length < 4) return false;

    let ascending = 0;
    let descending = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i] === data[i - 1] + 1) ascending++;
      if (data[i] === data[i - 1] - 1) descending++;
    }

    // More than 50% sequential is suspicious
    return ascending > data.length / 2 || descending > data.length / 2;
  }

  /**
   * Checks for repeated patterns in data.
   *
   * Detects patterns like [0xAB, 0xCD, 0xAB, 0xCD...].
   * Checks for 2, 4, and 8 byte repeating patterns.
   *
   * @private
   * @param {Uint8Array} data - Bytes to analyze
   * @returns {boolean} True if repeated pattern detected
   */
  private hasRepeatedPattern(data: Uint8Array): boolean {
    if (data.length < 8) return false;

    // Check for 2-byte, 4-byte, and 8-byte repeating patterns
    for (const patternLen of [2, 4, 8]) {
      if (data.length % patternLen !== 0) continue;

      let matches = 0;
      for (let i = patternLen; i < data.length; i++) {
        if (data[i] === data[i % patternLen]) matches++;
      }

      // 90%+ match = repeating pattern
      if (matches > (data.length - patternLen) * 0.9) {
        return true;
      }
    }

    return false;
  }

  /**
   * Analyzes entropy of PID and nonce in request headers.
   *
   * **Processing Flow:**
   * 1. Extract PID and nonce from header TLVs
   * 2. Calculate entropy for each
   * 3. Check for sequential patterns
   * 4. Check for repeated patterns
   * 5. Accumulate issues and score delta
   * 6. Return FLAG if issues found, ALLOW otherwise
   *
   * @param {SensorInput} input - Request with header TLVs
   * @returns {Promise<SensorDecision>} ALLOW or FLAG based on entropy analysis
   */
  async run(input: SensorInput): Promise<SensorDecision> {
    const headers = input.headerTLVs as Map<number, Uint8Array>;

    // If no headers, allow (WebSocket handshake, etc.)
    if (!headers) {
      return { action: "ALLOW" };
    }

    // Extract PID and nonce from headers
    const pid = headers.get(TLV_PID);
    const nonce = headers.get(TLV_NONCE);

    const issues: string[] = [];
    let totalDelta = 0;

    // === Analyze PID ===
    if (pid && pid.length > 0) {
      const pidEntropy = this.calculateEntropy(pid);

      // Check minimum entropy threshold
      if (pidEntropy < this.MIN_ENTROPY_THRESHOLD) {
        issues.push(`pid_low_entropy:${pidEntropy.toFixed(2)}`);
        totalDelta -= 3;
      }

      // Check for sequential pattern
      if (this.hasSequentialPattern(pid)) {
        issues.push("pid_sequential");
        totalDelta -= 5;
      }

      // Check for repeated pattern
      if (this.hasRepeatedPattern(pid)) {
        issues.push("pid_repeated");
        totalDelta -= 5;
      }
    }

    // === Analyze Nonce ===
    if (nonce && nonce.length > 0) {
      const nonceEntropy = this.calculateEntropy(nonce);

      // Check minimum entropy threshold
      if (nonceEntropy < this.MIN_ENTROPY_THRESHOLD) {
        issues.push(`nonce_low_entropy:${nonceEntropy.toFixed(2)}`);
        totalDelta -= 3;
      }

      // Check for sequential pattern
      if (this.hasSequentialPattern(nonce)) {
        issues.push("nonce_sequential");
        totalDelta -= 5;
      }

      // Check for repeated pattern
      if (this.hasRepeatedPattern(nonce)) {
        issues.push("nonce_repeated");
        totalDelta -= 5;
      }
    }

    // === Return Decision ===
    if (issues.length > 0) {
      this.logger.warn(`Entropy issues from ${input.ip}: ${issues.join(", ")}`);
      return {
        action: "FLAG",
        scoreDelta: totalDelta,
        reasons: issues,
      };
    }

    return { action: "ALLOW" };
  }

  /**
   * Generates cryptographically secure random bytes.
   *
   * Utility method for SDK/client code to ensure proper entropy.
   * Uses Node.js crypto.randomBytes for secure PRNG.
   *
   * @static
   * @param {number} length - Number of random bytes
   * @returns {Uint8Array} Cryptographically secure random bytes
   */
  static generateSecureRandom(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  }
}
