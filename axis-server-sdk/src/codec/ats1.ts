/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ATS1 (AXIS-TLV Schema v1) — TypeScript Encoder/Decoder
 * - Canonical TLV: [TAG(uvarint)][LEN(uvarint)][VALUE(bytes)]
 * - Canonical ordering: ascending TAG
 * - Minimal varint encoding enforced in decoder
 * - Strict schema validation (unknown tags rejected by default)
 * - Nested TLV streams supported
 *
 * Node.js: uses crypto for SHA-256
 */

import { createHash, randomBytes } from 'crypto';

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

  // Duplicate tags are allowed only if the schema says repeated.
  // This function does not enforce schema; caller should.
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

  if (schema.maxBodyBytes && tlvsBytes(tlvs) > schema.maxBodyBytes) {
    throw new Error('validateTLVsAgainstSchema: body too large');
  }

  const byTag = new Map<number, DecodedTlv[]>();
  for (const t of tlvs) {
    if (!byTag.has(t.tag)) byTag.set(t.tag, []);
    byTag.get(t.tag)!.push(t);
  }

  const fieldByTag = new Map(schema.fields.map((f) => [f.tag, f] as const));

  // Unknown tags
  if (schema.strict) {
    for (const tag of byTag.keys()) {
      if (!fieldByTag.has(tag))
        throw new Error(`validateTLVsAgainstSchema: unknown tag ${tag}`);
    }
  }

  // Required fields & repetition rules
  for (const f of schema.fields) {
    const vals = byTag.get(f.tag) ?? [];
    if (f.required && vals.length === 0)
      throw new Error(`validateTLVsAgainstSchema: missing ${f.name}`);

    if (!f.repeated && vals.length > 1) {
      throw new Error(
        `validateTLVsAgainstSchema: duplicate tag not allowed for ${f.name}`,
      );
    }

    // Per-field max length
    if (typeof f.maxLen === 'number') {
      for (const v of vals) {
        if (v.value.length > f.maxLen)
          throw new Error(`validateTLVsAgainstSchema: ${f.name} too long`);
      }
    }

    // Type checks (lightweight)
    for (const v of vals) {
      switch (f.type) {
        case 'u64be':
          if (v.value.length !== 8)
            throw new Error(
              `validateTLVsAgainstSchema: ${f.name} u64be must be 8 bytes`,
            );
          break;
        case 'nested': {
          if (!f.nestedSchema)
            throw new Error(
              `validateTLVsAgainstSchema: ${f.name} missing nestedSchema`,
            );
          const nestedTlvs = decodeTLVStream(v.value, limits);
          validateTLVsAgainstSchema(
            f.nestedSchema,
            nestedTlvs,
            depth + 1,
            limits,
          );
          break;
        }
        default:
          // bytes/utf8/uvarint are accepted structurally; deeper validation can be added if you want.
          break;
      }
    }
  }
}

function tlvsBytes(tlvs: DecodedTlv[]): number {
  // approximate encoded size if re-encoded
  let n = 0;
  for (const t of tlvs) {
    n +=
      encodeUVarint(t.tag).length +
      encodeUVarint(t.value.length).length +
      t.value.length;
  }
  return n;
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

    const pushOne = (v: any) => {
      const valueBuf = encodeFieldValue(f, v, limits);
      if (valueBuf.length > limits.maxValueBytes)
        throw new Error('logicalBodyToTLVs: value too large');
      tlvs.push({ tag: f.tag, value: valueBuf });
    };

    if (f.repeated) {
      if (!Array.isArray(val))
        throw new Error(
          `logicalBodyToTLVs: repeated field ${name} must be array`,
        );
      for (const item of val) pushOne(item);
    } else {
      pushOne(val);
    }
  }

  // Validate required + duplicates + nested schema correctness
  // Validation also enforces canonical ordering check only after encoding/decoding;
  // here we validate semantics.
  validateTLVsAgainstSchema(schema, tlvs, 0, limits);

  // NOTE: canonical ordering will be applied in encodeTLVStreamCanonical()
  return tlvs;
}

function encodeFieldValue(
  f: Ats1FieldDescriptor,
  val: any,
  limits: Ats1Limits,
): Buffer {
  switch (f.type) {
    case 'bytes':
      if (Buffer.isBuffer(val)) return Buffer.from(val);
      if (val instanceof Uint8Array) return Buffer.from(val);
      throw new Error(`encodeFieldValue: ${f.name} expects bytes`);
    case 'utf8':
      if (typeof val !== 'string')
        throw new Error(`encodeFieldValue: ${f.name} expects string`);
      return Buffer.from(val, 'utf8');
    case 'uvarint':
      if (typeof val !== 'number' && typeof val !== 'bigint')
        throw new Error(`encodeFieldValue: ${f.name} expects number/bigint`);
      return encodeUVarint(val);
    case 'u64be':
      if (typeof val !== 'bigint')
        throw new Error(`encodeFieldValue: ${f.name} expects bigint`);
      return encodeU64BE(val);
    case 'nested': {
      if (!f.nestedSchema)
        throw new Error(`encodeFieldValue: ${f.name} missing nestedSchema`);
      // Accept nested logical object in the form { fields: {...} } or direct record
      const nestedFields =
        val && typeof val === 'object' && 'fields' in val
          ? (val as any).fields
          : val;
      if (!nestedFields || typeof nestedFields !== 'object')
        throw new Error(`encodeFieldValue: ${f.name} expects object`);
      const nestedBody: LogicalBody = {
        schemaId: f.nestedSchema.schemaId,
        fields: nestedFields,
      };
      const nestedTlvs = logicalBodyToTLVs(f.nestedSchema, nestedBody, limits);
      const nestedBytes = encodeTLVStreamCanonical(nestedTlvs);
      // Re-parse to ensure canonical encoding would pass, and validate
      const re = decodeTLVStream(nestedBytes, limits);
      validateTLVsAgainstSchema(f.nestedSchema, re, 1, limits);
      return nestedBytes;
    }
    default:
      throw new Error(`encodeFieldValue: unsupported type ${(f as any).type}`);
  }
}

export function tlvsToLogicalBody(
  schema: Ats1SchemaDescriptor,
  tlvs: DecodedTlv[],
  limits: Ats1Limits = DEFAULT_LIMITS,
): LogicalBody {
  // TLVs must already be decoded and canonical-checked
  validateTLVsAgainstSchema(schema, tlvs, 0, limits);

  const fields: Record<string, any> = {};
  const fieldByTag = new Map(schema.fields.map((f) => [f.tag, f] as const));

  for (const t of tlvs) {
    const f = fieldByTag.get(t.tag);
    if (!f) {
      if (schema.strict)
        throw new Error(`tlvsToLogicalBody: unknown tag ${t.tag}`);
      continue;
    }

    const decoded = decodeFieldValue(f, t.value, limits);

    if (f.repeated) {
      if (!Array.isArray(fields[f.name])) fields[f.name] = [];
      fields[f.name].push(decoded);
    } else {
      fields[f.name] = decoded;
    }
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
      if (r.offset !== value.length)
        throw new Error(
          `decodeFieldValue: ${f.name} uvarint has trailing bytes`,
        );
      // return as number when safe, else bigint
      const asNum = Number(r.value);
      return Number.isSafeInteger(asNum) ? asNum : r.value;
    }
    case 'u64be':
      return decodeU64BE(value);
    case 'nested': {
      if (!f.nestedSchema)
        throw new Error(`decodeFieldValue: ${f.name} missing nestedSchema`);
      const nestedTlvs = decodeTLVStream(value, limits);
      // nested schema validation is called by validateTLVsAgainstSchema already,
      // but we decode again safely here.
      const nestedBody = tlvsToLogicalBody(f.nestedSchema, nestedTlvs, limits);
      return nestedBody.fields; // return the record by default
    }
    default:
      throw new Error(`decodeFieldValue: unsupported type ${(f as any).type}`);
  }
}

// -----------------------------
// AXIS HDR tags (ATS1 header TLVs)
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
  nonce: Uint8Array; // 16 bytes
  tsMs: bigint; // ms
  schemaId: number;
  bodyHash: Uint8Array; // 32 bytes
  traceId?: Uint8Array; // 16 bytes
  version?: number; // optional
  headerHash?: Uint8Array; // 32 bytes
  headerTlvs?: DecodedTlv[]; // optional
  bodyTlvs?: DecodedTlv[]; // optional
};

export type AxisLogicalRequest = {
  hdr: AxisHeaderLogical;
  body: LogicalBody;
};

export function encodeAxisHeaderToTLVs(hdr: AxisHeaderLogical): DecodedTlv[] {
  if (hdr.nonce.byteLength !== 16)
    throw new Error('encodeAxisHeaderToTLVs: nonce must be 16 bytes');
  if (hdr.bodyHash.byteLength !== 32)
    throw new Error('encodeAxisHeaderToTLVs: bodyHash must be 32 bytes');
  if (hdr.traceId && hdr.traceId.byteLength !== 16)
    throw new Error('encodeAxisHeaderToTLVs: traceId must be 16 bytes');

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

export function decodeAxisHeaderFromTLVs(
  hdrTlvs: DecodedTlv[],
  limits: Ats1Limits = DEFAULT_LIMITS,
): AxisHeaderLogical {
  // hdr TLVs must be canonical-ordered (enforced by decodeTLVStream) and duplicates only if allowed.
  const m = tlvsToMap(hdrTlvs);

  const get1 = (tag: number) => {
    const arr = m.get(tag);
    if (!arr || arr.length !== 1)
      throw new Error(
        `decodeAxisHeaderFromTLVs: missing/dup header tag ${tag}`,
      );
    return arr[0];
  };
  const getOpt1 = (tag: number) => {
    const arr = m.get(tag);
    if (!arr) return undefined;
    if (arr.length !== 1)
      throw new Error(`decodeAxisHeaderFromTLVs: dup header tag ${tag}`);
    return arr[0];
  };

  const intentIdVar = decodeUVarint(get1(HDR_TAGS.intent_id), 0, limits);
  if (intentIdVar.offset !== get1(HDR_TAGS.intent_id).length)
    throw new Error('decodeAxisHeaderFromTLVs: intent_id trailing bytes');

  const schemaIdVar = decodeUVarint(get1(HDR_TAGS.schema_id), 0, limits);
  if (schemaIdVar.offset !== get1(HDR_TAGS.schema_id).length)
    throw new Error('decodeAxisHeaderFromTLVs: schema_id trailing bytes');

  const ts = decodeU64BE(get1(HDR_TAGS.ts_ms));

  const nonce = get1(HDR_TAGS.nonce);
  if (nonce.length !== 16)
    throw new Error('decodeAxisHeaderFromTLVs: nonce must be 16 bytes');

  const bodyHash = get1(HDR_TAGS.body_hash);
  if (bodyHash.length !== 32)
    throw new Error('decodeAxisHeaderFromTLVs: body_hash must be 32 bytes');

  const trace = getOpt1(HDR_TAGS.trace_id);
  if (trace && trace.length !== 16)
    throw new Error('decodeAxisHeaderFromTLVs: trace_id must be 16 bytes');

  return {
    intentId: Number(intentIdVar.value),
    actorKeyId: Buffer.from(get1(HDR_TAGS.actor_key_id)),
    capsuleId: getOpt1(HDR_TAGS.capsule_id)
      ? Buffer.from(getOpt1(HDR_TAGS.capsule_id)!)
      : undefined,
    nonce: Buffer.from(nonce),
    tsMs: ts,
    schemaId: Number(schemaIdVar.value),
    bodyHash: Buffer.from(bodyHash),
    traceId: trace ? Buffer.from(trace) : undefined,
  };
}

// -----------------------------
// Encode/Decode AXIS request body + hdr with body_hash binding
// -----------------------------

export function encodeAxisRequestBinary(
  schema: Ats1SchemaDescriptor,
  req: Omit<AxisLogicalRequest, 'hdr'> & {
    hdr: Omit<AxisHeaderLogical, 'bodyHash'>;
  },
  limits: Ats1Limits = DEFAULT_LIMITS,
): { hdrBytes: Buffer; bodyBytes: Buffer; bodyHash: Buffer } {
  // 1) encode body TLVs
  const bodyTlvs = logicalBodyToTLVs(schema, req.body, limits);
  const bodyBytes = encodeTLVStreamCanonical(bodyTlvs);

  // 2) compute body hash
  const bodyHash = sha256(bodyBytes);

  // 3) encode hdr TLVs (with computed hash)
  const hdr: AxisHeaderLogical = {
    ...req.hdr,
    schemaId: schema.schemaId,
    bodyHash,
  };
  const hdrTlvs = encodeAxisHeaderToTLVs(hdr);
  const hdrBytes = encodeTLVStreamCanonical(hdrTlvs);

  return { hdrBytes, bodyBytes, bodyHash };
}

export function decodeAxisRequestBinary(
  schema: Ats1SchemaDescriptor,
  hdrBytes: Buffer,
  bodyBytes: Buffer,
  limits: Ats1Limits = DEFAULT_LIMITS,
): { hdr: AxisHeaderLogical; body: LogicalBody; sensorInput: SensorInputLike } {
  const hdrTlvs = decodeTLVStream(hdrBytes, limits);
  const bodyTlvs = decodeTLVStream(bodyBytes, limits);

  const hdr = decodeAxisHeaderFromTLVs(hdrTlvs, limits);

  // Schema binding check
  if (hdr.schemaId !== schema.schemaId)
    throw new Error('decodeAxisRequestBinary: schemaId mismatch');

  // body_hash check
  const bh = sha256(bodyBytes);
  if (!Buffer.from(hdr.bodyHash).equals(bh))
    throw new Error('decodeAxisRequestBinary: body_hash mismatch');

  // validate + decode body
  const body = tlvsToLogicalBody(schema, bodyTlvs, limits);

  const sensorInput: SensorInputLike = {
    hdrTLVs: tlvsToMap(hdrTlvs),
    bodyTLVs: tlvsToMap(bodyTlvs),
    schemaId: hdr.schemaId,
    intentId: hdr.intentId,
  };

  return { hdr, body, sensorInput };
}

// -----------------------------
// Example Schemas
// -----------------------------

export const Schema3100_DeviceContext: Ats1SchemaDescriptor = {
  schemaId: 3100,
  name: 'device.context',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'deviceId', type: 'bytes', required: true, maxLen: 128 },
    { tag: 2, name: 'os', type: 'utf8', required: true, maxLen: 64 },
    { tag: 3, name: 'hw', type: 'utf8', required: true, maxLen: 64 },
  ],
};

export const Schema2001_PasskeyLoginOptionsReq: Ats1SchemaDescriptor = {
  schemaId: 2001,
  name: 'axis.auth.passkey.login.options.req',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'username', type: 'utf8', required: true, maxLen: 128 },
  ],
};

export const Schema4001_LoginWithDeviceReq: Ats1SchemaDescriptor = {
  schemaId: 4001,
  name: 'axis.auth.login.with_device.req',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'username', type: 'utf8', required: true, maxLen: 128 },
    {
      tag: 2,
      name: 'device',
      type: 'nested',
      required: true,
      nestedSchema: Schema3100_DeviceContext,
    },
  ],
};
