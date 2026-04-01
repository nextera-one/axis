import 'reflect-metadata';

import {
  TLV_FIELDS_KEY,
  TLV_VALIDATORS_KEY,
  TlvFieldMeta,
  TlvValidatorMeta,
} from '../decorators/tlv-field.decorator';
import { AxisTlvDto } from './axis-tlv.dto';

/**
 * AxisPartialType — Creates a DTO class where all TLV fields are optional.
 *
 * Copies TLV metadata (`axis:tlv:fields` + `axis:tlv:validators`)
 * and sets `required: false` on every field.
 *
 * TLV naturally supports partial payloads — only fields present in the
 * binary body get decoded. This utility makes the schema/sensor layer
 * aware that missing fields are acceptable for update operations.
 *
 * @example
 * ```typescript
 * export class UpdateBlocklistDto extends AxisPartialType(CreateBlocklistDto) {}
 * ```
 */
export function AxisPartialType<T extends new (...args: any[]) => AxisTlvDto>(
  BaseDto: T,
): new (...args: any[]) => Partial<InstanceType<T>> & AxisTlvDto {
  class PartialDto extends (BaseDto as any) {}

  const fields: TlvFieldMeta[] =
    Reflect.getOwnMetadata(TLV_FIELDS_KEY, BaseDto) || [];

  const partialFields: TlvFieldMeta[] = fields.map((f) => ({
    property: f.property,
    tag: f.tag,
    options: { ...f.options, required: false },
  }));

  Reflect.defineMetadata(TLV_FIELDS_KEY, partialFields, PartialDto);

  const validators: TlvValidatorMeta[] =
    Reflect.getOwnMetadata(TLV_VALIDATORS_KEY, BaseDto) || [];

  if (validators.length > 0) {
    Reflect.defineMetadata(TLV_VALIDATORS_KEY, [...validators], PartialDto);
  }

  Object.defineProperty(PartialDto, 'name', {
    value: `Partial${BaseDto.name}`,
  });

  return PartialDto as any;
}
