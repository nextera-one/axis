import "reflect-metadata";

import type { IntentTlvField } from "./intent.decorator";
import {
  TLV_FIELDS_KEY,
  TLV_VALIDATORS_KEY,
  TlvFieldMeta,
  TlvValidatorFn,
  TlvValidatorMeta,
} from "./tlv-field.decorator";
import { decodeTLVs } from "../core/tlv";

/** Extracted schema from a DTO class — fields + optional validators */
export interface DtoSchema {
  fields: IntentTlvField[];
  validators: Map<number, TlvValidatorFn[]>;
}

/**
 * Extracts TLV field definitions and validators from a DTO class
 * decorated with @TlvField and @TlvValidate.
 */
export function extractDtoSchema(dto: Function): DtoSchema {
  if (typeof dto !== "function") {
    throw new Error(
      `extractDtoSchema expected a class constructor but received ${typeof dto} (${String(dto)}) — ` +
        `did you pass a plain object or instance to @Intent({ dto }) instead of a class?`,
    );
  }

  const fieldMetas: TlvFieldMeta[] =
    Reflect.getMetadata(TLV_FIELDS_KEY, dto) || [];

  if (fieldMetas.length === 0) {
    throw new Error(
      `DTO class ${dto.name || "<anonymous>"} has no @TlvField decorators — nothing to validate. ` +
        `Make sure the class extends AxisTlvDto and its fields are annotated with @TlvField(tag, { kind }).`,
    );
  }

  const tagByProp = new Map<string, number>();
  const fields: IntentTlvField[] = fieldMetas.map((m) => {
    tagByProp.set(m.property, m.tag);
    return {
      name: m.property,
      tag: m.tag,
      kind: m.options.kind,
      required: m.options.required,
      maxLen: m.options.maxLen,
      max: m.options.max,
      scope: m.options.scope,
    };
  });

  const validatorMetas: TlvValidatorMeta[] =
    Reflect.getMetadata(TLV_VALIDATORS_KEY, dto) || [];

  const validators = new Map<number, TlvValidatorFn[]>();
  for (const vm of validatorMetas) {
    const tag = tagByProp.get(vm.property);
    if (tag === undefined) {
      throw new Error(
        `@TlvValidate on ${dto.name}.${vm.property} but no @TlvField found for that property`,
      );
    }
    vm.tag = tag;
    validators.set(tag, vm.validators);
  }

  return { fields, validators };
}

/**
 * Builds a decoder function for a DTO class.
 *
 * The returned function takes raw TLV body bytes and returns a plain object
 * with property names as keys and decoded values matching the DTO shape.
 *
 * Value decoding by kind:
 *  - utf8  → string
 *  - u64   → bigint
 *  - bytes / bytes16 → Uint8Array
 *  - bool  → boolean (0x00 = false, anything else = true)
 *  - obj   → JSON.parse of utf8
 *  - arr   → JSON.parse of utf8
 */
export function buildDtoDecoder(
  dto: Function,
): (bodyBytes: Buffer) => Record<string, any> {
  if (typeof dto !== "function") {
    throw new Error(
      `buildDtoDecoder expected a class constructor but received ${typeof dto} (${String(dto)}) — ` +
        `did you pass a plain object or instance to @Intent({ dto }) instead of a class?`,
    );
  }

  const fieldMetas: TlvFieldMeta[] =
    Reflect.getMetadata(TLV_FIELDS_KEY, dto) || [];

  if (fieldMetas.length === 0) {
    throw new Error(
      `DTO class ${dto.name || "<anonymous>"} has no @TlvField decorators — cannot build decoder. ` +
        `Make sure the class extends AxisTlvDto and its fields are annotated with @TlvField(tag, { kind }).`,
    );
  }

  const tagMap = new Map<number, { property: string; kind: string }>();
  for (const m of fieldMetas) {
    tagMap.set(m.tag, { property: m.property, kind: m.options.kind });
  }

  // Capture optional post-decode hook defined on the DTO class
  const afterDecode: ((dto: Record<string, any>) => void) | undefined = (
    dto as any
  ).afterDecode;

  return (bodyBytes: Buffer): Record<string, any> => {
    const tlvMap = decodeTLVs(new Uint8Array(bodyBytes));
    const result: Record<string, any> = {};

    for (const [tag, raw] of tlvMap) {
      const meta = tagMap.get(tag);
      if (!meta) continue;

      switch (meta.kind) {
        case "utf8":
          result[meta.property] = new TextDecoder().decode(raw);
          break;
        case "u64": {
          let n = 0n;
          for (let i = 0; i < raw.length; i++) {
            n = (n << 8n) | BigInt(raw[i]);
          }
          result[meta.property] = n;
          break;
        }
        case "bytes":
        case "bytes16":
          result[meta.property] = raw;
          break;
        case "bool":
          result[meta.property] = raw.length > 0 && raw[0] !== 0;
          break;
        case "obj":
        case "arr":
          result[meta.property] = JSON.parse(new TextDecoder().decode(raw));
          break;
        default:
          result[meta.property] = raw;
      }
    }

    afterDecode?.(result);

    return result;
  };
}
