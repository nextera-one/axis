import 'reflect-metadata';

export const TLV_FIELDS_KEY = 'axis:tlv:fields';
export const TLV_VALIDATORS_KEY = 'axis:tlv:validators';

export type TlvFieldKind =
  | 'utf8'
  | 'u64'
  | 'bytes'
  | 'bytes16'
  | 'bool'
  | 'obj'
  | 'arr';

export interface TlvFieldOptions {
  /** Value type for type-specific validation */
  kind: TlvFieldKind;
  /** If true, sensor denies when this tag is missing */
  required?: boolean;
  /** Maximum byte length of the value */
  maxLen?: number;
  /** Maximum numeric value (string for bigint-safe limits) */
  max?: string;
  /** Which frame section contains this field (default: 'body') */
  scope?: 'header' | 'body';
}

/** Stored per-property metadata from @TlvField */
export interface TlvFieldMeta {
  /** Property name on the DTO class */
  property: string;
  /** TLV tag number */
  tag: number;
  /** Field options */
  options: TlvFieldOptions;
}

/**
 * Custom validation function applied via @TlvValidate.
 * Receives the raw TLV value bytes and the property name.
 * Return null/undefined to pass, or a string error message to deny.
 */
export type TlvValidatorFn = (
  value: Uint8Array,
  property: string,
) => string | null | undefined;

/** Stored per-property validator from @TlvValidate */
export interface TlvValidatorMeta {
  property: string;
  tag: number;
  validators: TlvValidatorFn[];
}

/**
 * @TlvField — Declare a TLV field contract on a DTO property.
 *
 * Applied to properties of a class passed to `@Intent({ dto: MyDto })`.
 * The schema is extracted at bootstrap and forwarded to SchemaValidationSensor.
 *
 * @example
 * ```typescript
 * class LoginDto {
 *   @TlvField(100, { kind: 'utf8', required: true, maxLen: 256 })
 *   email: string;
 *
 *   @TlvField(105, { kind: 'bytes16', required: true })
 *   deviceId: Buffer;
 *
 *   @TlvField(103, { kind: 'bool' })
 *   remember?: boolean;
 * }
 * ```
 */
export function TlvField(
  tag: number,
  options: TlvFieldOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: TlvFieldMeta[] =
      Reflect.getOwnMetadata(TLV_FIELDS_KEY, target.constructor) || [];

    existing.push({
      property: String(propertyKey),
      tag,
      options,
    });

    Reflect.defineMetadata(TLV_FIELDS_KEY, existing, target.constructor);
  };
}

/**
 * @TlvValidate — Attach custom validation logic to a TLV field.
 *
 * Runs after standard type/size checks. The validator receives raw bytes
 * and must return null (pass) or an error string (deny).
 *
 * Multiple @TlvValidate decorators can be stacked on the same property.
 */
export function TlvValidate(validator: TlvValidatorFn): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: TlvValidatorMeta[] =
      Reflect.getOwnMetadata(TLV_VALIDATORS_KEY, target.constructor) || [];

    const prop = String(propertyKey);
    let entry = existing.find((e) => e.property === prop);

    if (!entry) {
      entry = { property: prop, tag: 0, validators: [] };
      existing.push(entry);
    }

    entry.validators.push(validator);

    Reflect.defineMetadata(TLV_VALIDATORS_KEY, existing, target.constructor);
  };
}

// ─── Built-in Validators (composable with @TlvValidate) ───

/**
 * @TlvUtf8Pattern — Validate a UTF-8 field against a regex.
 */
export function TlvUtf8Pattern(
  pattern: RegExp,
  message?: string,
): PropertyDecorator {
  return TlvValidate((val, prop) => {
    const str = new TextDecoder().decode(val);
    return pattern.test(str)
      ? null
      : message || `${prop}: failed pattern check`;
  });
}

/**
 * @TlvMinLen — Minimum byte length for a field value.
 */
export function TlvMinLen(min: number, message?: string): PropertyDecorator {
  return TlvValidate((val, prop) => {
    return val.length >= min
      ? null
      : message || `${prop}: too short (${val.length} < ${min})`;
  });
}

/**
 * @TlvEnum — UTF-8 field must be one of the listed values.
 */
export function TlvEnum(
  allowed: string[],
  message?: string,
): PropertyDecorator {
  const set = new Set(allowed);
  return TlvValidate((val, prop) => {
    const str = new TextDecoder().decode(val);
    return set.has(str)
      ? null
      : message || `${prop}: must be one of [${allowed.join(', ')}]`;
  });
}

/**
 * @TlvRange — Numeric u64 field must be within [min, max].
 */
export function TlvRange(
  min: bigint,
  max: bigint,
  message?: string,
): PropertyDecorator {
  return TlvValidate((val, prop) => {
    if (val.length !== 8) return `${prop}: u64 must be 8 bytes`;
    let n = 0n;
    for (const b of val) n = (n << 8n) | BigInt(b);
    if (n < min || n > max) {
      return message || `${prop}: value ${n} out of range [${min}, ${max}]`;
    }
    return null;
  });
}
