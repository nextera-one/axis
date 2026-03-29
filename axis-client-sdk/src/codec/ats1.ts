/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ATS1 (AXIS-TLV Schema v1) — TypeScript Encoder/Decoder
 * - Canonical TLV: [TAG(uvarint)][LEN(uvarint)][VALUE(bytes)]
 * - Canonical ordering: ascending TAG
 * - Minimal varint encoding enforced in decoder
 * - Strict schema validation (unknown tags rejected by default)
 * - Nested TLV streams supported
 */

// Note: For browser/native compatibility, we use a generic hash interface.
// In the client SDK, we'll assume a global or utility-provided SHA-256.

import { createHash } from 'crypto';

// -----------------------------
// Types
// -----------------------------

export type Ats1FieldType = 'bytes' | 'utf8' | 'uvarint' | 'u64be' | 'nested';

export type Ats1FieldDescriptor = {
  tag: number;
  name: string;
  type: Ats1FieldType;
  required?: boolean;
  repeated?: boolean;
  nestedSchema?: Ats1SchemaDescriptor; // required if type === 'nested'
  maxLen?: number; // optional per-field limit (bytes length)
};

export type Ats1SchemaDescriptor = {
  schemaId: number;
  name: string;
  strict: boolean; // if true: reject unknown tags
  maxNestingDepth: number; // e.g. 4
  maxBodyBytes?: number; // optional overall body limit
  fields: Ats1FieldDescriptor[];
};

export type DecodedTlv = { tag: number; value: Buffer };

export type DecodedTlvMap = Map<number, Buffer[]>; // tag -> list of values

export type SensorInputLike = {
  hdrTLVs: DecodedTlvMap;
  bodyTLVs: DecodedTlvMap;
  schemaId: number;
  intentId: number;
};

// -----------------------------
// Limits (sane defaults)
// -----------------------------

export type Ats1Limits = {
  maxVarintBytes: number; // e.g. 10 for u64
  maxTlvCount: number; // e.g. 512
  maxValueBytes: number; // e.g. 1MB
  maxNestingDepth: number; // e.g. 4
};

export const DEFAULT_LIMITS: Ats1Limits = {
  maxVarintBytes: 10,
  maxTlvCount: 512,
  maxValueBytes: 1_048_576, // 1 MiB
  maxNestingDepth: 4,
};

// -----------------------------
// Varint (unsigned LEB128)
// -----------------------------

export function encodeUVarint(n: number | bigint): Buffer {
  let x = typeof n === 'bigint' ? n : BigInt(n);
  if (x < 0n) throw new Error('encodeUVarint: negative not allowed');

  const out: number[] = [];
  while (x >= 0x80n) {
    out.push(Number((x & 0x7fn) | 0x80n));
    x >>= 7n;
  }
  out.push(Number(x));
  return Buffer.from(out);
}

export function decodeUVarint(
  buf: Buffer,
  offset: number,
  limits: Ats1Limits = DEFAULT_LIMITS,
): { value: bigint; offset: number; bytesRead: number } {
  let x = 0n;
  let shift = 0n;
  const start = offset;

  for (let i = 0; i < limits.maxVarintBytes; i++) {
    if (offset >= buf.length) throw new Error('decodeUVarint: truncated');
    const b = buf[offset++];
    x |= BigInt(b & 0x7f) << shift;

    if ((b & 0x80) === 0) {
      const bytesRead = offset - start;

      // Minimal-encoding check:
      // Re-encode and compare exact bytes.
      const re = encodeUVarint(x);
      const original = buf.subarray(start, offset);
      if (!re.equals(original))
        throw new Error('decodeUVarint: non-minimal varint');

      return { value: x, offset, bytesRead };
    }

    shift += 7n;
  }

  throw new Error('decodeUVarint: too long');
}

// -----------------------------
// Primitive encoders/decoders
// -----------------------------

export function encodeU64BE(n: bigint): Buffer {
  if (n < 0n) throw new Error('encodeU64BE: negative not allowed');
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(n, 0);
  return b;
}

export function decodeU64BE(buf: Buffer): bigint {
  if (buf.length !== 8) throw new Error('decodeU64BE: length must be 8');
  return buf.readBigUInt64BE(0);
}

export function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

// -----------------------------
// TLV encode/decode
// -----------------------------

export function encodeTLV(tag: number, value: Buffer): Buffer {
  if (!Number.isInteger(tag) || tag <= 0)
    throw new Error('encodeTLV: tag must be positive int');
  const t = encodeUVarint(tag);
  const l = encodeUVarint(value.length);
  return Buffer.concat([t, l, value]);
}

export function encodeTLVStreamCanonical(entries: DecodedTlv[]): Buffer {
  // Canonical sort ascending tag
  const sorted = [...entries].sort((a, b) => a.tag - b.tag);

  const parts: Buffer[] = [];
  for (const e of sorted) parts.push(encodeTLV(e.tag, e.value));
  return Buffer.concat(parts);
}

export function decodeTLVStream(
  stream: Buffer,
  limits: Ats1Limits = DEFAULT_LIMITS,
): DecodedTlv[] {
  const out: DecodedTlv[] = [];
  let off = 0;

  while (off < stream.length) {
    if (out.length >= limits.maxTlvCount)
      throw new Error('decodeTLVStream: too many TLVs');

    const tagRes = decodeUVarint(stream, off, limits);
    const tag = Number(tagRes.value);
    off = tagRes.offset;

    const lenRes = decodeUVarint(stream, off, limits);
    const len = Number(lenRes.value);
    off = lenRes.offset;

    if (len < 0) throw new Error('decodeTLVStream: negative length');
    if (len > limits.maxValueBytes)
      throw new Error('decodeTLVStream: value too large');
    if (off + len > stream.length)
      throw new Error('decodeTLVStream: truncated value');

    const value = stream.subarray(off, off + len);
    off += len;

    out.push({ tag, value: Buffer.from(value) });
  }

  // Canonical check: must be sorted ascending tag.
  for (let i = 1; i < out.length; i++) {
    if (out[i].tag < out[i - 1].tag)
      throw new Error('decodeTLVStream: non-canonical tag order');
  }

  return out;
}

export function tlvsToMap(entries: DecodedTlv[]): DecodedTlvMap {
  const m: DecodedTlvMap = new Map();
  for (const e of entries) {
    const arr = m.get(e.tag) ?? [];
    arr.push(e.value);
    m.set(e.tag, arr);
  }
  return m;
}

// -----------------------------
// Schema validation + object \u2194 TLV mapping
// -----------------------------

type LogicalBody = { schemaId: number; fields: Record<string, any> };

export function validateTLVsAgainstSchema(
  schema: Ats1SchemaDescriptor,
  tlvs: DecodedTlv[],
  depth = 0,
  limits: Ats1Limits = DEFAULT_LIMITS,
): void {
  if (depth > Math.min(schema.maxNestingDepth, limits.maxNestingDepth)) {
    throw new Error('validateTLVsAgainstSchema: nesting depth exceeded');
  }

  const byTag = new Map<number, DecodedTlv[]>();
  for (const t of tlvs) {
    if (!byTag.has(t.tag)) byTag.set(t.tag, []);
    byTag.get(t.tag)!.push(t);
  }

  const fieldByTag = new Map(schema.fields.map((f) => [f.tag, f] as const));

  if (schema.strict) {
    for (const tag of byTag.keys()) {
      if (!fieldByTag.has(tag))
        throw new Error(`validateTLVsAgainstSchema: unknown tag ${tag}`);
    }
  }

  for (const f of schema.fields) {
    const vals = byTag.get(f.tag) ?? [];
    if (f.required && vals.length === 0)
      throw new Error(`validateTLVsAgainstSchema: missing ${f.name}`);
    if (!f.repeated && vals.length > 1)
      throw new Error(`validateTLVsAgainstSchema: duplicate ${f.name}`);

    for (const v of vals) {
      if (f.type === 'u64be' && v.value.length !== 8)
        throw new Error(`validateTLVsAgainstSchema: ${f.name} invalid u64be`);
      if (f.type === 'nested') {
        if (!f.nestedSchema)
          throw new Error(
            `validateTLVsAgainstSchema: ${f.name} missing schema`,
          );
        const nestedTlvs = decodeTLVStream(v.value, limits);
        validateTLVsAgainstSchema(
          f.nestedSchema,
          nestedTlvs,
          depth + 1,
          limits,
        );
      }
    }
  }
}

export function logicalBodyToTLVs(
  schema: Ats1SchemaDescriptor,
  body: LogicalBody,
  limits: Ats1Limits = DEFAULT_LIMITS,
): DecodedTlv[] {
  if (body.schemaId !== schema.schemaId)
    throw new Error('logicalBodyToTLVs: schemaId mismatch');
  const fieldsByName = new Map(schema.fields.map((f) => [f.name, f] as const));
  const tlvs: DecodedTlv[] = [];

  for (const [name, val] of Object.entries(body.fields ?? {})) {
    const f = fieldsByName.get(name);
    if (!f) {
      if (schema.strict)
        throw new Error(`logicalBodyToTLVs: unknown field ${name}`);
      continue;
    }
    const pushOne = (v: any) =>
      tlvs.push({ tag: f.tag, value: encodeFieldValue(f, v, limits) });
    if (f.repeated) {
      if (!Array.isArray(val))
        throw new Error(`logicalBodyToTLVs: ${name} must be array`);
      for (const item of val) pushOne(item);
    } else pushOne(val);
  }

  validateTLVsAgainstSchema(schema, tlvs, 0, limits);
  return tlvs;
}

function encodeFieldValue(
  f: Ats1FieldDescriptor,
  val: any,
  limits: Ats1Limits,
): Buffer {
  switch (f.type) {
    case 'bytes':
      return Buffer.from(val);
    case 'utf8':
      return Buffer.from(val, 'utf8');
    case 'uvarint':
      return encodeUVarint(val);
    case 'u64be':
      return encodeU64BE(val);
    case 'nested': {
      if (!f.nestedSchema) throw new Error('encodeFieldValue: missing schema');
      const nestedFields =
        val && typeof val === 'object' && 'fields' in val
          ? (val as any).fields
          : val;
      const nestedTlvs = logicalBodyToTLVs(
        f.nestedSchema,
        { schemaId: f.nestedSchema.schemaId, fields: nestedFields },
        limits,
      );
      return encodeTLVStreamCanonical(nestedTlvs);
    }
    default:
      throw new Error(`encodeFieldValue: unsupported type ${f.type}`);
  }
}

export function tlvsToLogicalBody(
  schema: Ats1SchemaDescriptor,
  tlvs: DecodedTlv[],
  limits: Ats1Limits = DEFAULT_LIMITS,
): LogicalBody {
  validateTLVsAgainstSchema(schema, tlvs, 0, limits);
  const fields: Record<string, any> = {};
  const fieldByTag = new Map(schema.fields.map((f) => [f.tag, f] as const));

  for (const t of tlvs) {
    const f = fieldByTag.get(t.tag);
    if (!f) continue;
    const decoded = decodeFieldValue(f, t.value, limits);
    if (f.repeated) {
      if (!Array.isArray(fields[f.name])) fields[f.name] = [];
      fields[f.name].push(decoded);
    } else fields[f.name] = decoded;
  }
  return { schemaId: schema.schemaId, fields };
}

function decodeFieldValue(
  f: Ats1FieldDescriptor,
  value: Buffer,
  limits: Ats1Limits,
): any {
  switch (f.type) {
    case 'bytes':
      return Buffer.from(value);
    case 'utf8':
      return value.toString('utf8');
    case 'uvarint': {
      const r = decodeUVarint(value, 0, limits);
      return Number.isSafeInteger(Number(r.value)) ? Number(r.value) : r.value;
    }
    case 'u64be':
      return decodeU64BE(value);
    case 'nested': {
      if (!f.nestedSchema) throw new Error('decodeFieldValue: missing schema');
      const nestedTlvs = decodeTLVStream(value, limits);
      return tlvsToLogicalBody(f.nestedSchema, nestedTlvs, limits).fields;
    }
    default:
      throw new Error('decodeFieldValue: unsupported type');
  }
}

// -----------------------------
// AXIS HDR tags
// -----------------------------

export const HDR_TAGS = {
  intent_id: 1,
  actor_key_id: 2,
  capsule_id: 3,
  nonce: 4,
  ts_ms: 5,
  schema_id: 6,
  body_hash: 7,
  trace_id: 8,
} as const;

export type AxisHeaderLogical = {
  intentId: number;
  actorKeyId: Uint8Array;
  capsuleId?: Uint8Array;
  nonce: Uint8Array;
  tsMs: bigint;
  schemaId: number;
  bodyHash: Uint8Array;
  traceId?: Uint8Array;
};

export type AxisLogicalRequest = {
  hdr: AxisHeaderLogical;
  body: LogicalBody;
};

export function encodeAxisHeaderToTLVs(hdr: AxisHeaderLogical): DecodedTlv[] {
  const tlvs: DecodedTlv[] = [
    { tag: HDR_TAGS.intent_id, value: encodeUVarint(hdr.intentId) },
    { tag: HDR_TAGS.actor_key_id, value: Buffer.from(hdr.actorKeyId) },
    { tag: HDR_TAGS.nonce, value: Buffer.from(hdr.nonce) },
    { tag: HDR_TAGS.ts_ms, value: encodeU64BE(hdr.tsMs) },
    { tag: HDR_TAGS.schema_id, value: encodeUVarint(hdr.schemaId) },
    { tag: HDR_TAGS.body_hash, value: Buffer.from(hdr.bodyHash) },
  ];
  if (hdr.capsuleId)
    tlvs.push({ tag: HDR_TAGS.capsule_id, value: Buffer.from(hdr.capsuleId) });
  if (hdr.traceId)
    tlvs.push({ tag: HDR_TAGS.trace_id, value: Buffer.from(hdr.traceId) });
  return tlvs;
}

export function encodeAxisRequestBinary(
  schema: Ats1SchemaDescriptor,
  req: Omit<AxisLogicalRequest, 'hdr'> & {
    hdr: Omit<AxisHeaderLogical, 'bodyHash'>;
  },
  limits: Ats1Limits = DEFAULT_LIMITS,
): { hdrBytes: Buffer; bodyBytes: Buffer; bodyHash: Buffer } {
  const bodyTlvs = logicalBodyToTLVs(schema, req.body, limits);
  const bodyBytes = encodeTLVStreamCanonical(bodyTlvs);
  const bodyHash = sha256(bodyBytes);
  const hdr: AxisHeaderLogical = {
    ...req.hdr,
    schemaId: schema.schemaId,
    bodyHash,
  };
  const hdrBytes = encodeTLVStreamCanonical(encodeAxisHeaderToTLVs(hdr));
  return { hdrBytes, bodyBytes, bodyHash };
}
