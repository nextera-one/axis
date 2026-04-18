import { decodeTLVs, encodeTLVs, type TLV } from '../binary/tlv';
import { decodeVarint, encodeVarint } from '../binary/varint';

import type {
  AxisChainEnvelope,
  AxisChainRequest,
  AxisChainStep,
} from './intent-chain';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LIST_ITEM_TAG = 1;

enum ChainRequestTag {
  ENVELOPE = 1,
  CAPSULE = 2,
  ACTOR_ID = 3,
}

enum ChainEnvelopeTag {
  CHAIN_ID = 1,
  MODE = 2,
  SUBJECT = 3,
  ISSUER = 4,
  ISSUED_AT_TPS = 5,
  EXPIRES_AT_TPS = 6,
  SIGNATURE = 7,
  ENCRYPTION = 8,
  CAPSULE = 9,
  KEY_EXCHANGE = 10,
  OBSERVER_TAGS = 11,
  DYNAMIC = 12,
  METADATA = 13,
  STEPS = 14,
}

enum ChainStepTag {
  STEP_ID = 1,
  INTENT = 2,
  HANDLER = 3,
  INPUT = 4,
  DEPENDS_ON = 5,
  ON_SUCCESS = 6,
  ON_FAILURE = 7,
  CAPSULE_SCOPE = 8,
  OBSERVER_TAGS = 9,
  PROOF_REQUIRED = 10,
  KEY_EXCHANGE = 11,
  METADATA = 12,
}

export function encodeChainEnvelope<TInput = unknown>(
  envelope: AxisChainEnvelope<TInput>,
): Uint8Array {
  const tlvs: TLV[] = [
    { type: ChainEnvelopeTag.CHAIN_ID, value: encodeUtf8(envelope.chainId) },
    { type: ChainEnvelopeTag.MODE, value: encodeUtf8(envelope.mode) },
    {
      type: ChainEnvelopeTag.STEPS,
      value: encodeRepeatedItems(envelope.steps.map((step) => encodeChainStep(step))),
    },
  ];

  pushString(tlvs, ChainEnvelopeTag.SUBJECT, envelope.subject);
  pushString(tlvs, ChainEnvelopeTag.ISSUER, envelope.issuer);
  pushString(
    tlvs,
    ChainEnvelopeTag.ISSUED_AT_TPS,
    envelope.issuedAtTps !== undefined ? String(envelope.issuedAtTps) : undefined,
  );
  pushString(
    tlvs,
    ChainEnvelopeTag.EXPIRES_AT_TPS,
    envelope.expiresAtTps !== undefined ? String(envelope.expiresAtTps) : undefined,
  );
  pushString(tlvs, ChainEnvelopeTag.SIGNATURE, envelope.signature);
  pushJson(tlvs, ChainEnvelopeTag.ENCRYPTION, envelope.encryption);
  pushJson(tlvs, ChainEnvelopeTag.CAPSULE, envelope.capsule);
  pushJson(tlvs, ChainEnvelopeTag.KEY_EXCHANGE, envelope.keyExchange);
  pushList(tlvs, ChainEnvelopeTag.OBSERVER_TAGS, envelope.observerTags);
  pushBoolean(tlvs, ChainEnvelopeTag.DYNAMIC, envelope.dynamic);
  pushJson(tlvs, ChainEnvelopeTag.METADATA, envelope.metadata);

  return encodeTLVs(tlvs);
}

export function decodeChainEnvelope<TInput = unknown>(
  bytes: Uint8Array,
): AxisChainEnvelope<TInput> {
  const map = decodeTLVs(bytes);
  const chainId = decodeUtf8Required(map.get(ChainEnvelopeTag.CHAIN_ID), 'CHAIN_ID_REQUIRED');
  const mode = decodeUtf8Required(map.get(ChainEnvelopeTag.MODE), 'CHAIN_MODE_REQUIRED');
  const stepsValue = map.get(ChainEnvelopeTag.STEPS);
  if (!stepsValue) {
    throw new Error('CHAIN_STEPS_REQUIRED');
  }

  return {
    chainId,
    mode: mode as AxisChainEnvelope<TInput>['mode'],
    subject: decodeUtf8(map.get(ChainEnvelopeTag.SUBJECT)),
    issuer: decodeUtf8(map.get(ChainEnvelopeTag.ISSUER)),
    issuedAtTps: decodeUtf8(map.get(ChainEnvelopeTag.ISSUED_AT_TPS)),
    expiresAtTps: decodeUtf8(map.get(ChainEnvelopeTag.EXPIRES_AT_TPS)),
    signature: decodeUtf8(map.get(ChainEnvelopeTag.SIGNATURE)),
    encryption: decodeJson(map.get(ChainEnvelopeTag.ENCRYPTION)),
    capsule: decodeJson(map.get(ChainEnvelopeTag.CAPSULE)),
    keyExchange: decodeJson(map.get(ChainEnvelopeTag.KEY_EXCHANGE)),
    observerTags: decodeStringList(map.get(ChainEnvelopeTag.OBSERVER_TAGS)),
    dynamic: decodeBoolean(map.get(ChainEnvelopeTag.DYNAMIC)),
    metadata: decodeJson(map.get(ChainEnvelopeTag.METADATA)),
    steps: decodeRepeatedItems(stepsValue, (value) => decodeChainStep<TInput>(value)),
  };
}

export function encodeChainRequest<
  TInput = unknown,
  TCapsule = Record<string, unknown>,
>(request: AxisChainRequest<TInput, TCapsule>): Uint8Array {
  const tlvs: TLV[] = [
    { type: ChainRequestTag.ENVELOPE, value: encodeChainEnvelope(request.envelope) },
  ];

  pushJson(tlvs, ChainRequestTag.CAPSULE, request.capsule);
  pushString(tlvs, ChainRequestTag.ACTOR_ID, request.actorId);

  return encodeTLVs(tlvs);
}

export function decodeChainRequest<
  TInput = unknown,
  TCapsule = Record<string, unknown>,
>(bytes: Uint8Array): AxisChainRequest<TInput, TCapsule> {
  const map = decodeTLVs(bytes);
  const envelopeBytes = map.get(ChainRequestTag.ENVELOPE);
  if (!envelopeBytes) {
    throw new Error('CHAIN_ENVELOPE_REQUIRED');
  }

  return {
    envelope: decodeChainEnvelope<TInput>(envelopeBytes),
    capsule: decodeJson<TCapsule>(map.get(ChainRequestTag.CAPSULE)),
    actorId: decodeUtf8(map.get(ChainRequestTag.ACTOR_ID)),
  };
}

function encodeChainStep<TInput = unknown>(step: AxisChainStep<TInput>): Uint8Array {
  const tlvs: TLV[] = [
    { type: ChainStepTag.STEP_ID, value: encodeUtf8(step.stepId) },
    { type: ChainStepTag.INTENT, value: encodeUtf8(step.intent) },
  ];

  pushString(tlvs, ChainStepTag.HANDLER, step.handler);
  pushJson(tlvs, ChainStepTag.INPUT, step.input);
  pushList(tlvs, ChainStepTag.DEPENDS_ON, step.dependsOn);
  pushList(tlvs, ChainStepTag.ON_SUCCESS, step.onSuccess);
  pushList(tlvs, ChainStepTag.ON_FAILURE, step.onFailure);
  pushScope(tlvs, ChainStepTag.CAPSULE_SCOPE, step.capsuleScope);
  pushList(tlvs, ChainStepTag.OBSERVER_TAGS, step.observerTags);
  pushBoolean(tlvs, ChainStepTag.PROOF_REQUIRED, step.proofRequired);
  pushJson(tlvs, ChainStepTag.KEY_EXCHANGE, step.keyExchange);
  pushJson(tlvs, ChainStepTag.METADATA, step.metadata);

  return encodeTLVs(tlvs);
}

function decodeChainStep<TInput = unknown>(bytes: Uint8Array): AxisChainStep<TInput> {
  const map = decodeTLVs(bytes);

  return {
    stepId: decodeUtf8Required(map.get(ChainStepTag.STEP_ID), 'CHAIN_STEP_ID_REQUIRED'),
    intent: decodeUtf8Required(map.get(ChainStepTag.INTENT), 'CHAIN_STEP_INTENT_REQUIRED'),
    handler: decodeUtf8(map.get(ChainStepTag.HANDLER)),
    input: decodeJson<TInput>(map.get(ChainStepTag.INPUT)),
    dependsOn: decodeStringList(map.get(ChainStepTag.DEPENDS_ON)),
    onSuccess: decodeStringList(map.get(ChainStepTag.ON_SUCCESS)),
    onFailure: decodeStringList(map.get(ChainStepTag.ON_FAILURE)),
    capsuleScope: decodeScope(map.get(ChainStepTag.CAPSULE_SCOPE)),
    observerTags: decodeStringList(map.get(ChainStepTag.OBSERVER_TAGS)),
    proofRequired: decodeBoolean(map.get(ChainStepTag.PROOF_REQUIRED)),
    keyExchange: decodeJson(map.get(ChainStepTag.KEY_EXCHANGE)),
    metadata: decodeJson(map.get(ChainStepTag.METADATA)),
  };
}

function pushString(tlvs: TLV[], type: number, value?: string): void {
  if (value === undefined || value === '') {
    return;
  }
  tlvs.push({ type, value: encodeUtf8(value) });
}

function pushJson(tlvs: TLV[], type: number, value: unknown): void {
  if (value === undefined) {
    return;
  }
  tlvs.push({ type, value: encodeUtf8(stableJsonStringify(value)) });
}

function pushList(tlvs: TLV[], type: number, value?: string[]): void {
  if (!value || value.length === 0) {
    return;
  }
  tlvs.push({ type, value: encodeRepeatedItems(value.map((item) => encodeUtf8(item))) });
}

function pushScope(tlvs: TLV[], type: number, value?: string | string[]): void {
  if (!value) {
    return;
  }
  pushList(tlvs, type, Array.isArray(value) ? value : [value]);
}

function pushBoolean(tlvs: TLV[], type: number, value?: boolean): void {
  if (value === undefined) {
    return;
  }
  tlvs.push({ type, value: new Uint8Array([value ? 1 : 0]) });
}

function encodeUtf8(value: string): Uint8Array {
  return encoder.encode(value);
}

function decodeUtf8(value?: Uint8Array): string | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  return decoder.decode(value);
}

function decodeUtf8Required(value: Uint8Array | undefined, errorCode: string): string {
  const decoded = decodeUtf8(value);
  if (!decoded) {
    throw new Error(errorCode);
  }
  return decoded;
}

function decodeJson<T = Record<string, unknown>>(value?: Uint8Array): T | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  return JSON.parse(decoder.decode(value)) as T;
}

function decodeStringList(value?: Uint8Array): string[] | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  const items = decodeRepeatedItems(value, (item) => decodeUtf8Required(item, 'CHAIN_LIST_ITEM_REQUIRED'));
  return items.length > 0 ? items : undefined;
}

function decodeScope(value?: Uint8Array): string | string[] | undefined {
  const list = decodeStringList(value);
  if (!list || list.length === 0) {
    return undefined;
  }
  return list.length === 1 ? list[0] : list;
}

function decodeBoolean(value?: Uint8Array): boolean | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }
  return value[0] !== 0;
}

function encodeRepeatedItems(values: Uint8Array[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (const value of values) {
    const typeBytes = encodeVarint(LIST_ITEM_TAG);
    const lengthBytes = encodeVarint(value.length);
    chunks.push(typeBytes, lengthBytes, value);
    total += typeBytes.length + lengthBytes.length + value.length;
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function decodeRepeatedItems<T>(
  bytes: Uint8Array,
  decodeItem: (value: Uint8Array) => T,
): T[] {
  return decodeTLVsList(bytes).map((item) => {
    if (item.type !== LIST_ITEM_TAG) {
      throw new Error(`CHAIN_LIST_ITEM_INVALID:${item.type}`);
    }
    return decodeItem(item.value);
  });
}

function decodeTLVsList(bytes: Uint8Array): TLV[] {
  const list: TLV[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const typeResult = decodeVarint(bytes, offset);
    const type = Number(typeResult.value);
    offset = typeResult.offset;

    const lengthResult = decodeVarint(bytes, offset);
    const length = Number(lengthResult.value);
    offset = lengthResult.offset;

    if (offset + length > bytes.length) {
      throw new Error('CHAIN_LIST_TRUNCATED');
    }

    list.push({ type, value: bytes.slice(offset, offset + length) });
    offset += length;
  }

  return list;
}

function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = sortJsonValue((value as Record<string, unknown>)[key]);
      return accumulator;
    }, {});
}