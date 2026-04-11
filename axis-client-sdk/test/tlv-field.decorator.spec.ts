import 'reflect-metadata';

import { describe, expect, test } from 'vitest';

import {
  TLV_FIELDS_KEY,
  TlvField,
  TlvUtf8Pattern,
  TlvValidate,
} from '../src/decorators/tlv-field.decorator';

describe('tlv-field.decorator', () => {
  test('TlvUtf8Pattern remains deterministic with global regex flags', () => {
    const decorator = TlvUtf8Pattern(/^[a-z]+$/g);

    class SampleDto {
      value!: string;
    }

    decorator(SampleDto.prototype, 'value');

    const validators = Reflect.getOwnMetadata(
      'axis:tlv:validators',
      SampleDto,
    ) as Array<{
      property: string;
      validators: Array<(value: Uint8Array, property: string) => string | null | undefined>;
    }>;

    const validator = validators[0]?.validators[0];
    const value = new TextEncoder().encode('axis');

    expect(validator(value, 'value')).toBeNull();
    expect(validator(value, 'value')).toBeNull();
  });

  test('TlvField rejects duplicate property metadata', () => {
    class DuplicatePropertyDto {
      value!: string;
    }

    const first = TlvField(100, { kind: 'utf8' });
    const second = TlvField(101, { kind: 'utf8' });

    first(DuplicatePropertyDto.prototype, 'value');

    expect(() => second(DuplicatePropertyDto.prototype, 'value')).toThrow(
      'Duplicate @TlvField for property value',
    );
  });

  test('TlvField rejects duplicate tag metadata', () => {
    class DuplicateTagDto {
      first!: string;
      second!: string;
    }

    const first = TlvField(100, { kind: 'utf8' });
    const second = TlvField(100, { kind: 'utf8' });

    first(DuplicateTagDto.prototype, 'first');

    expect(() => second(DuplicateTagDto.prototype, 'second')).toThrow(
      'Duplicate @TlvField tag 100 for second; already used by first',
    );
  });

  test('TlvValidate still accumulates multiple validators on one property', () => {
    class ValidatorDto {
      value!: string;
    }

    const first = TlvValidate(() => null);
    const second = TlvValidate(() => null);

    first(ValidatorDto.prototype, 'value');
    second(ValidatorDto.prototype, 'value');

    const validators = Reflect.getOwnMetadata(
      'axis:tlv:validators',
      ValidatorDto,
    ) as Array<{ property: string; validators: unknown[] }>;

    expect(validators).toHaveLength(1);
    expect(validators[0]?.property).toBe('value');
    expect(validators[0]?.validators).toHaveLength(2);
  });

  test('field metadata is stored once per property', () => {
    class FieldDto {
      value!: string;
    }

    TlvField(100, { kind: 'utf8' })(FieldDto.prototype, 'value');

    const fields = Reflect.getOwnMetadata(TLV_FIELDS_KEY, FieldDto) as Array<{
      property: string;
      tag: number;
    }>;

    expect(fields).toEqual([{ property: 'value', tag: 100, options: { kind: 'utf8' } }]);
  });
});