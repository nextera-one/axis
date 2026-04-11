import "reflect-metadata";

type ReflectWithMetadata = typeof Reflect & {
  getOwnMetadata: (metadataKey: string, target: object) => unknown;
  defineMetadata: (
    metadataKey: string,
    metadataValue: unknown,
    target: object,
  ) => void;
};

const reflectMetadata = Reflect as ReflectWithMetadata;
const textDecoder = new TextDecoder();

function assertUniqueFieldMetadata(
  existing: TlvFieldMeta[],
  property: string,
  tag: number,
): void {
  const duplicateProperty = existing.find((item) => item.property === property);
  if (duplicateProperty) {
    throw new Error(`Duplicate @TlvField for property ${property}`);
  }

  const duplicateTag = existing.find((item) => item.tag === tag);
  if (duplicateTag) {
    throw new Error(
      `Duplicate @TlvField tag ${tag} for ${property}; already used by ${duplicateTag.property}`,
    );
  }
}

export const TLV_FIELDS_KEY = "axis:tlv:fields";
export const TLV_VALIDATORS_KEY = "axis:tlv:validators";

export type TlvFieldKind =
  | "utf8"
  | "u64"
  | "bytes"
  | "bytes16"
  | "bool"
  | "obj"
  | "arr";

export interface TlvFieldOptions {
  kind: TlvFieldKind;
  required?: boolean;
  maxLen?: number;
  max?: string;
  scope?: "header" | "body";
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
      (reflectMetadata.getOwnMetadata(
        TLV_FIELDS_KEY,
        target.constructor,
      ) as TlvFieldMeta[]) || [];

    const property = String(propertyKey);
    assertUniqueFieldMetadata(existing, property, tag);

    existing.push({
      property,
      tag,
      options,
    });

    reflectMetadata.defineMetadata(
      TLV_FIELDS_KEY,
      existing,
      target.constructor,
    );
  };
}

export function TlvValidate(validator: TlvValidatorFn): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: TlvValidatorMeta[] =
      (reflectMetadata.getOwnMetadata(
        TLV_VALIDATORS_KEY,
        target.constructor,
      ) as TlvValidatorMeta[]) || [];

    const prop = String(propertyKey);
    let entry = existing.find((item) => item.property === prop);

    if (!entry) {
      entry = { property: prop, tag: 0, validators: [] };
      existing.push(entry);
    }

    entry.validators.push(validator);

    reflectMetadata.defineMetadata(
      TLV_VALIDATORS_KEY,
      existing,
      target.constructor,
    );
  };
}

export function TlvUtf8Pattern(
  pattern: RegExp,
  message?: string,
): PropertyDecorator {
  const matcher = new RegExp(pattern.source, pattern.flags);
  return TlvValidate((value, property) => {
    const decoded = textDecoder.decode(value);
    matcher.lastIndex = 0;
    return matcher.test(decoded)
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
    const decoded = textDecoder.decode(value);
    return set.has(decoded)
      ? null
      : message || `${property}: must be one of [${allowed.join(", ")}]`;
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
      return (
        message || `${property}: value ${decoded} out of range [${min}, ${max}]`
      );
    }

    return null;
  });
}
