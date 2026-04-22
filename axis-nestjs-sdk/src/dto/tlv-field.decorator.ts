import 'reflect-metadata';

export const TLV_FIELDS_KEY = 'axis:tlv:fields';

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

export function TlvField(
  tag: number,
  options: TlvFieldOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing: TlvFieldMeta[] =
      Reflect.getOwnMetadata(TLV_FIELDS_KEY, target.constructor) || [];

    const property = String(propertyKey);
    assertUniqueFieldMetadata(existing, property, tag);

    existing.push({
      property,
      tag,
      options,
    });

    Reflect.defineMetadata(TLV_FIELDS_KEY, existing, target.constructor);
  };
}
