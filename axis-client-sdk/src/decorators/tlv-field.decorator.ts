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
  kind: TlvFieldKind;
  required?: boolean;
  maxLen?: number;
  max?: string;
  scope?: 'header' | 'body';
}

export interface TlvFieldMeta {
  property: string;
  tag: number;
  options: TlvFieldOptions;
}

export type TlvValidatorFn = (
  value: Uint8Array,
  property: string,
) => string | null | undefined;

export interface TlvValidatorMeta {
  property: string;
  tag: number;
  validators: TlvValidatorFn[];
}

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

export function TlvValidate(validator: TlvValidatorFn): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: TlvValidatorMeta[] =
      Reflect.getOwnMetadata(TLV_VALIDATORS_KEY, target.constructor) || [];

    const prop = String(propertyKey);
    let entry = existing.find((item) => item.property === prop);

    if (!entry) {
      entry = { property: prop, tag: 0, validators: [] };
      existing.push(entry);
    }

    entry.validators.push(validator);

    Reflect.defineMetadata(TLV_VALIDATORS_KEY, existing, target.constructor);
  };
}

export function TlvUtf8Pattern(
  pattern: RegExp,
  message?: string,
): PropertyDecorator {
  return TlvValidate((value, property) => {
    const decoded = new TextDecoder().decode(value);
    return pattern.test(decoded)
      ? null
      : message || `${property}: failed pattern check`;
  });
}

export function TlvMinLen(min: number, message?: string): PropertyDecorator {
  return TlvValidate((value, property) => {
    return value.length >= min
      ? null
      : message || `${property}: too short (${value.length} < ${min})`;
  });
}

export function TlvEnum(
  allowed: string[],
  message?: string,
): PropertyDecorator {
  const set = new Set(allowed);
  return TlvValidate((value, property) => {
    const decoded = new TextDecoder().decode(value);
    return set.has(decoded)
      ? null
      : message || `${property}: must be one of [${allowed.join(', ')}]`;
  });
}

export function TlvRange(
  min: bigint,
  max: bigint,
  message?: string,
): PropertyDecorator {
  return TlvValidate((value, property) => {
    if (value.length !== 8) return `${property}: u64 must be 8 bytes`;

    let decoded = 0n;
    for (const byte of value) {
      decoded = (decoded << 8n) | BigInt(byte);
    }

    if (decoded < min || decoded > max) {
      return message || `${property}: value ${decoded} out of range [${min}, ${max}]`;
    }

    return null;
  });
}