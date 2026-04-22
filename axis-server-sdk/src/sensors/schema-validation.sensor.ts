
import { Sensor } from '../decorators/sensor.decorator';
import { BAND } from '../engine/sensor-bands';
import { IntentSchema, IntentSchemaZ } from '../schemas/axis-schemas';
import { AxisSensor } from '../sensor/axis-sensor';
import { AxisError } from '../core/axis-error';
import type { TlvValidatorFn } from '../decorators/tlv-field.decorator';

/**
 * Reads a big-endian unsigned 64-bit integer from a byte array.
 *
 * @param {Uint8Array} b - 8-byte array
 * @returns {bigint} The decoded integer
 * @throws {AxisError} If array is not exactly 8 bytes
 */
function readU64be(b: Uint8Array): bigint {
  if (b.length !== 8)
    throw new AxisError('SCHEMA_TYPE_MISMATCH', 'u64 must be 8 bytes', 400);
  let x = 0n;
  for (const by of b) x = (x << 8n) | BigInt(by);
  return x;
}

/**
 * Schema Validation Sensor - TLV Field Contract Enforcement
 *
 * Validates that incoming request bodies conform to the defined intent schema.
 * This ensures type safety and data integrity before handler execution.
 *
 * **Execution Order:** 170 (late in pipeline, after all auth/policy checks)
 *
 * **Core Concept:**
 * Every AXIS intent can define a schema that specifies:
 * - Required fields and their TLV types
 * - Field types (utf8, bytes, u64, bool, etc.)
 * - Size limits per field
 * - Scope (header or body)
 *
 * The sensor validates each field against its schema definition, rejecting
 * requests that violate the contract.
 *
 * **Supported Field Types:**
 * | Kind | Description | Validation |
 * |------|-------------|------------|
 * | `utf8` | UTF-8 string | Valid UTF-8 encoding |
 * | `bool` | Boolean | 1 byte: 0x00 or 0x01 |
 * | `u64` | Unsigned 64-bit int | Exactly 8 bytes, big-endian |
 * | `bytes16` | Fixed 16 bytes | Exactly 16 bytes (UUIDs) |
 * | `bytes` | Variable bytes | Any length up to maxLen |
 * | `obj` | Nested object | (Reserved for future) |
 * | `arr` | Array | (Reserved for future) |
 *
 * **How It Works:**
 * ```
 * 1. Validate schema structure with Zod
 * 2. For each field in schema:
 *    a. Look up TLV in headers or body (based on scope)
 *    b. Check if field is required
 *    c. Check size against maxLen
 *    d. Validate type (utf8 encoding, bool values, etc.)
 * 3. Throw AxisError on any violation
 * ```
 *
 * **Security Model:**
 * - **Fail Closed:** Schema violations throw errors (no silent failures)
 * - **Pre-Handler:** All validation happens before handler execution
 * - **Type-Safe:** Handlers receive type-validated data
 *
 * **Error Codes:**
 * - `SCHEMA_INVALID` - Schema itself is malformed
 * - `SCHEMA_FIELD_MISSING` - Required field not present
 * - `SCHEMA_LIMIT_EXCEEDED` - Field exceeds maxLen or max value
 * - `SCHEMA_TYPE_MISMATCH` - Field type doesn't match expected
 *
 * **Performance:**
 * - In-memory validation (no I/O)
 * - O(n) where n = number of schema fields
 * - Latency: ~1-5ms for typical schemas
 *
 * @class SchemaValidationSensor
 * @implements {OnModuleInit}
 *
 * @example
 * Valid schema validation:
 * ```typescript
 * const schema = {
 *   fields: [
 *     { name: 'fullName', tlv: 100, kind: 'utf8', required: true, maxLen: 256 },
 *     { name: 'age', tlv: 101, kind: 'u64', max: 150 }
 *   ]
 * };
 * // Body TLVs contain valid data
 * { ok: true }
 * ```
 *
 * @example
 * Missing required field:
 * ```typescript
 * // TLV 100 (fullName) not present in body
 * throw AxisError('SCHEMA_FIELD_MISSING',
 *   'Missing required field: fullName (TLV 100)', 400);
 * ```
 *
 * @see {@link IntentSchema}
 */
@Sensor()
export class SchemaValidationSensor implements AxisSensor {
  /** Sensor identifier for logging and registry */
  readonly name = 'SchemaValidationSensor';

  /**
   * Execution order - runs late in the pipeline
   *
   * Order 170 ensures:
   * - All authentication complete
   * - All policy checks complete
   * - Data validated before handler execution
   */
  readonly order = BAND.CONTENT + 35;

  /**
   * Determines if this sensor should process the given input.
   *
   * Only activates when a schema is provided for the intent (post-decode phase).
   *
   * @param {any} input - Sensor input
   * @returns {boolean} True if schema exists in metadata
   */
  supports(input: any): boolean {
    // Only run in post-decode phase when schema is provided
    return !!input.metadata?.schema;
  }

  /**
   * Validates TLV fields against the schema definition.
   *
   * **Validation Steps:**
   * 1. Validate the schema itself using Zod
   * 2. Iterate through each field definition
   * 3. Check required fields are present
   * 4. Validate size limits (maxLen)
   * 5. Validate type-specific rules
   *
   * @param {any} input - Standard SensorInput
   * @returns {{ action: 'ALLOW' } | { action: 'DENY', code: string, reason: string }} Decision
   */
  async run(
    input: any,
  ): Promise<
    { action: 'ALLOW' } | { action: 'DENY'; code: string; reason: string }
  > {
    const schema = input.metadata?.schema as IntentSchema;
    const headerTLVs = input.headerTLVs as Map<number, Uint8Array>;
    const bodyTLVs = input.bodyTLVs as Map<number, Uint8Array> | undefined;

    // If no schema, allow (no validation needed)
    if (!schema) {
      return { action: 'ALLOW' };
    }

    // === STEP 1: Validate Schema Structure ===
    const validatedSchema = IntentSchemaZ.safeParse(schema);
    if (!validatedSchema.success) {
      return {
        action: 'DENY',
        code: 'SCHEMA_INVALID',
        reason: `Schema validation failed: ${validatedSchema.error.message}`,
      };
    }

    // === STEP 2: Validate Each Field ===
    try {
      for (const field of schema.fields) {
        // Determine which TLV map to use (header or body)
        const scope = field.scope ?? 'body';
        const map = scope === 'header' ? headerTLVs : bodyTLVs;

        // Get the field value from the appropriate map
        const val = map?.get(field.tlv);

        // === Check Required Fields ===
        if (field.required && !val) {
          throw new AxisError(
            'SCHEMA_FIELD_MISSING',
            `Missing required field: ${field.name} (TLV ${field.tlv})`,
            400,
          );
        }

        // Skip validation if field not present (and not required)
        if (!val) continue;

        // === Check Size Limit ===
        if (typeof field.maxLen === 'number' && val.length > field.maxLen) {
          throw new AxisError(
            'SCHEMA_LIMIT_EXCEEDED',
            `Field ${field.name} too large (${val.length} > ${field.maxLen})`,
            413, // Payload Too Large
          );
        }

        // === Type-Specific Validation ===
        switch (field.kind) {
          case 'utf8':
            // Validate UTF-8 encoding
            try {
              new TextDecoder('utf-8', { fatal: true }).decode(val);
            } catch {
              throw new AxisError(
                'SCHEMA_TYPE_MISMATCH',
                `Invalid UTF-8 in ${field.name}`,
                400,
              );
            }
            break;

          case 'bool':
            // Boolean must be exactly 1 byte: 0x00 or 0x01
            if (val.length !== 1 || (val[0] !== 0 && val[0] !== 1)) {
              throw new AxisError(
                'SCHEMA_TYPE_MISMATCH',
                `Invalid bool: ${field.name}`,
                400,
              );
            }
            break;

          case 'u64': {
            // Unsigned 64-bit integer (big-endian)
            const x = readU64be(val);

            // Check max value if specified
            if (field.max) {
              const mx = BigInt(field.max);
              if (x > mx) {
                throw new AxisError(
                  'SCHEMA_LIMIT_EXCEEDED',
                  `u64 ${field.name} exceeds max (${x} > ${mx})`,
                  400,
                );
              }
            }
            break;
          }

          case 'bytes16':
            // Fixed 16-byte field (UUIDs, IDs)
            if (val.length !== 16) {
              throw new AxisError(
                'SCHEMA_TYPE_MISMATCH',
                `bytes16 required for ${field.name}`,
                400,
              );
            }
            break;

          case 'bytes':
            // Variable-length bytes - any length within maxLen is allowed
            break;

          case 'obj':
          case 'arr':
            // Nested object/array validation (reserved for future)
            // TODO: Implement nested validation
            break;

          default:
            throw new AxisError(
              'SCHEMA_TYPE_MISMATCH',
              `Unknown schema kind: ${field.kind}`,
              500,
            );
        }
      }

      // === STEP 3: Run custom @TlvValidate validators ===
      const validators = input.metadata?.validators as
        | Map<number, TlvValidatorFn[]>
        | undefined;
      if (validators && validators.size > 0) {
        for (const field of schema.fields) {
          const fns = validators.get(field.tlv);
          if (!fns || fns.length === 0) continue;

          const scope = field.scope ?? 'body';
          const map = scope === 'header' ? headerTLVs : bodyTLVs;
          const val = map?.get(field.tlv);
          if (!val) continue; // missing fields already handled above

          for (const fn of fns) {
            const error = fn(val, field.name);
            if (error) {
              throw new AxisError(
                'SCHEMA_VALIDATION_FAILED',
                `${field.name} (TLV ${field.tlv}): ${error}`,
                400,
              );
            }
          }
        }
      }
    } catch (err: any) {
      // Convert AxisError to DENY decision
      if (err instanceof AxisError) {
        return {
          action: 'DENY',
          code: err.code,
          reason: err.message,
        };
      }
      throw err; // Re-throw unknown errors
    }

    return { action: 'ALLOW' };
  }
}
