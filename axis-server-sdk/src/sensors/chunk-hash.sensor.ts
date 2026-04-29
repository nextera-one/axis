import { createHash } from "crypto";

import { Sensor } from "../decorators/sensor.decorator";
import { BAND } from "../engine/sensor-bands";
import { AxisError } from "../core/axis-error";
import { AxisSensor, SensorDecision, SensorInput } from "../sensor/axis-sensor";

/**
 * Chunk Hash Sensor - Data Integrity Verification
 *
 * Validates that uploaded file chunks match their declared SHA-256 hash.
 * This ensures data integrity during transfer and detects corruption or
 * tampering.
 *
 * **Execution Order:** 190 (after session validation, before handler)
 *
 * **Core Concept:**
 * Each file chunk includes a SHA-256 hash in the header. The sensor:
 * 1. Extracts the expected hash from header TLV
 * 2. Computes the actual hash of the body
 * 3. Compares them byte-by-byte
 * 4. Rejects if mismatch (data corruption)
 *
 * This provides end-to-end integrity verification, catching:
 * - Network corruption
 * - Storage errors
 * - Man-in-the-middle modifications
 * - Client-side bugs
 *
 * **TLV Type:**
 * - Type 73 (`TLV_SHA256_CHUNK`): 32-byte SHA-256 hash
 *
 * **Hash Calculation:**
 * ```typescript
 * const actual = createHash('sha256').update(bodyBytes).digest();
 * ```
 *
 * **Security Model:**
 * - **Fail Closed:** Hash mismatch = DENY
 * - **Immutable Check:** Hash computed server-side
 * - **Early Rejection:** Before storage writes
 *
 * **Actions:**
 * - `ALLOW` - Hash matches
 * - `DENY` - Hash mismatch or missing
 *
 * **Error Codes:**
 * - `FILE_CHUNK_HASH_MISSING` - TLV 73 not present or wrong size
 * - `FILE_CHUNK_HASH_MISMATCH` - Computed hash != expected hash
 *
 * **Performance:**
 * - SHA-256 computation: ~100MB/s on modern CPUs
 * - For 1MB chunk: ~10ms
 *
 * @class ChunkHashSensor
 * @implements {AxisSensor}
 *
 * @example
 * Hash matches:
 * ```typescript
 * // Header TLV 73: sha256(body) = expected
 * { action: 'ALLOW' }
 * ```
 *
 * @example
 * Hash mismatch:
 * ```typescript
 * // Body was corrupted during transfer
 * {
 *   action: 'DENY',
 *   code: 'FILE_CHUNK_HASH_MISMATCH',
 *   reason: 'Chunk hash mismatch - data corrupted'
 * }
 * ```
 *
 * @see {@link FileUploadStateSensor} - Session validation
 * @see {@link https://en.wikipedia.org/wiki/SHA-2 SHA-256}
 */
@Sensor()
export class ChunkHashSensor implements AxisSensor {
  /** Sensor identifier */
  readonly name = "ChunkHashSensor";

  /**
   * Execution order - after session validation
   *
   * Order 190 ensures:
   * - Session validated (180)
   * - Chunk parameters verified
   * - Hash check before storage
   */
  readonly order = BAND.CONTENT + 50;

  /**
   * Determines if this sensor should process the given input.
   *
   * Only processes file.chunk intents.
   *
   * @param {SensorInput} input - Incoming request
   * @returns {boolean} True if intent is 'file.chunk'
   */
  async supports(input: SensorInput): Promise<SensorDecision> {
    return input.intent === "file.chunk"
      ? { action: "ALLOW" }
      : {
          action: "DENY",
          code: "SENSOR_NOT_APPLICABLE",
          reason: "Only file.chunk intent is supported",
        };
  }

  /**
   * Validates chunk data against declared SHA-256 hash.
   *
   * **Processing Flow:**
   * 1. Check for required headerTLVs and body
   * 2. Extract expected hash from TLV 73
   * 3. Verify hash is exactly 32 bytes
   * 4. Compute SHA-256 of body
   * 5. Compare bytes (timing-safe)
   * 6. DENY on mismatch
   *
   * @param {SensorInput} input - Request with chunk body
   * @returns {Promise<SensorDecision>} ALLOW if hash matches, DENY otherwise
   */
  async run(input: SensorInput): Promise<SensorDecision> {
    const headerTLVs = input.headerTLVs as Map<number, Uint8Array>;
    const bodyBytes = input.body as Uint8Array;

    // Validate required inputs
    if (!headerTLVs || !bodyBytes) {
      return {
        action: "DENY",
        code: "SENSOR_INVALID_INPUT",
        reason: "Missing headerTLVs or body",
      };
    }

    // TLV type for chunk SHA-256 hash
    const TLV_SHA256_CHUNK = 73;

    // === STEP 1: Extract Expected Hash ===
    const expected = headerTLVs.get(TLV_SHA256_CHUNK);

    if (!expected || expected.length !== 32) {
      return {
        action: "DENY",
        code: "FILE_CHUNK_HASH_MISSING",
        reason: "Missing sha256Chunk TLV in header",
      };
    }

    // === STEP 2: Compute Actual Hash ===
    const actual = createHash("sha256").update(bodyBytes).digest();

    // === STEP 3: Compare Hashes ===
    // Using Buffer.equals for comparison
    if (!Buffer.from(actual).equals(Buffer.from(expected))) {
      return {
        action: "DENY",
        code: "FILE_CHUNK_HASH_MISMATCH",
        reason: "Chunk hash mismatch - data corrupted",
      };
    }

    return { action: "ALLOW" };
  }
}
