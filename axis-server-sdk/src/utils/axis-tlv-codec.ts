import {
  buildTLVs,
  extractDtoSchema,
} from '../index';
import type { IntentTlvField } from '../decorators/intent.decorator';

type AxisTlvDtoCtor<T = object> = new (...args: never[]) => T;

export function encodeAxisTlvDto<T extends object>(
  dtoClass: AxisTlvDtoCtor<T>,
  data: Partial<Record<keyof T, unknown>>,
): Uint8Array {
  const schema = extractDtoSchema(dtoClass);
  const items = schema.fields.flatMap((field) => {
    const value = (data as Record<string, unknown>)[field.name];
    if (value === undefined || value === null) {
      if (field.required) {
        throw new Error(`Missing required TLV response field: ${field.name}`);
      }
      return [];
    }

    return [{ type: field.tag, value: encodeField(field, value) }];
  });

  return buildTLVs(items);
}

function encodeField(field: IntentTlvField, value: unknown): Buffer {
  switch (field.kind) {
    case 'utf8':
      return Buffer.from(String(value), 'utf8');
    case 'u64':
      return encodeU64(value);
    case 'bytes':
    case 'bytes16':
      return toBuffer(value);
    case 'bool':
      return Buffer.from([value ? 1 : 0]);
    case 'obj':
    case 'arr':
      return Buffer.from(JSON.stringify(value), 'utf8');
    default:
      return toBuffer(value);
  }
}

function encodeU64(value: unknown): Buffer {
  const encoded = Buffer.alloc(8);
  encoded.writeBigUInt64BE(
    typeof value === 'bigint' ? value : BigInt(value as number | string),
  );
  return encoded;
}

function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    return Buffer.from(value, 'utf8');
  }

  throw new Error(`Unsupported TLV bytes value: ${typeof value}`);
}