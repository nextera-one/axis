/**
 * AXIS Studio transport service.
 *
 * Builds AXIS1 request frames, sends them to the configured node, and keeps
 * contract-aware request/response snapshots for the studio viewer.
 */

import {
  AxisFrameBuilder,
  FrameFlags,
  ProofType,
  TLVType,
  bytesToUuid,
  decodeVarint,
  decodeTLVs,
  encodeTLVs,
  generateNonce,
  generatePid,
  uuidToBytes,
} from "@nextera.one/axis-client-sdk/browser";
import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { sha512 } from "@noble/hashes/sha512";

import { useAuthStore, type AuthenticatedUser } from "stores/auth";
import { AxisMediaTypes } from "./axis-media-types";
import { useConnectionStore } from "stores/connection";
import { useHistoryStore } from "stores/history";

ed.hashes.sha512 = sha512;
ed.hashes.sha512Async = async (message: Uint8Array) => sha512(message);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const EMPTY_16 = new Uint8Array(16);
const MAX_RAW_CHARS = 16_000;
const DEV_PROXY_PATH = "/axis";
const DEV_PROXY_TARGET_HEADER = "X-AXIS-Proxy-Target";
const TLV_CAPSULE = 90;
const CAPSULE_BODY_ENCRYPTION_ALG = "A256GCM.SHA256";
const DEFAULT_CATALOG_PAGE_SIZE = Number.MAX_SAFE_INTEGER;

// Intent prefixes that are always routed plain by the server (no decryption).
// Must stay in sync with IntentAliasService.PASSTHROUGH_PREFIXES on the backend.
const INTENT_PASSTHROUGH_PREFIXES = [
  "public.",
  "schema.",
  "system.",
  "health.",
  "catalog.",
];
const CAPSULE_BOOTSTRAP_INTENTS = [
  "axis.capsules.create",
  "capsule.issue",
  "capsule.create",
];
const FALLBACK_CAPSULE_INTENTS = new Set(["projects.page"]);

function isPassthroughIntent(intent: string): boolean {
  return INTENT_PASSTHROUGH_PREFIXES.some((p) => intent.startsWith(p));
}

function isPublicIntent(
  intent: string,
  metadata?: IntentCatalogEntry | null,
): boolean {
  const proof = metadata?.requiredProof;
  if (Array.isArray(proof)) {
    return proof.length === 0 || proof.some((p) => p.toUpperCase() === "NONE");
  }

  return isPassthroughIntent(intent);
}

function shouldSignFrame(
  intent: string,
  metadata: IntentCatalogEntry | null | undefined,
  hasCapsule: boolean,
): boolean {
  if (hasCapsule) return true;
  return !isPublicIntent(intent, metadata);
}

type SnapshotTransport =
  | "axis-bin"
  | "json"
  | "cce-response"
  | "cce-error"
  | "text"
  | "binary";

export interface ProtocolSnapshot {
  transport: SnapshotTransport;
  tree: unknown;
  raw: string;
}

export interface SendResult {
  ok: boolean;
  status: number;
  durationMs: number;
  response: any;
  raw: string;
  effect: string;
  requestSnapshot: ProtocolSnapshot;
  responseSnapshot: ProtocolSnapshot;
  responseHeaders: Record<string, string>;
}

type TlvFieldKind =
  | "utf8"
  | "u64"
  | "bytes"
  | "bytes16"
  | "bool"
  | "obj"
  | "arr";

export interface IntentFieldDoc {
  name: string;
  tag: number;
  kind: TlvFieldKind | string;
  required?: boolean;
  scope?: string;
  maxLen?: number;
  max?: string | number;
}

export interface IntentCatalogEntry {
  intent: string;
  description?: string;
  sensitivity?: string;
  requiredProof?: string[];
  contract?: { maxDbWrites?: number; maxTimeMs?: number };
  bodyProfile?: string;
  input?: IntentFieldDoc[];
  fields?: IntentFieldDoc[];
  schema?: { bodyProfile?: string; fields?: IntentFieldDoc[] } | unknown;
  inputSchema?: { bodyProfile?: string; fields?: IntentFieldDoc[] } | unknown;
  request?: {
    bodyProfile?: string;
    input?: IntentFieldDoc[];
    fields?: IntentFieldDoc[];
  };
  examples?: string[];
  deprecated?: boolean;
}

interface BodyEncodingSpec {
  profile?: string;
  fields: IntentFieldDoc[];
}

interface AxisFrameLike {
  flags: number;
  headers: Map<number, Uint8Array>;
  body: Uint8Array;
  sig: Uint8Array;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatHex(bytes: Uint8Array, columns = 16): string {
  if (!bytes.length) return "(empty)";
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += columns) {
    const row = Array.from(bytes.slice(i, i + columns))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    lines.push(row);
  }
  return lines.join("\n");
}

function truncateRaw(raw: string, limit = MAX_RAW_CHARS): string {
  if (raw.length <= limit) return raw;
  return `${raw.slice(0, limit)}\n\n… truncated (${raw.length - limit} chars omitted)`;
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getBrowserCrypto(): Crypto | undefined {
  return typeof globalThis.crypto !== "undefined"
    ? globalThis.crypto
    : undefined;
}

function requireSubtleCrypto(feature: string): SubtleCrypto {
  const subtle = getBrowserCrypto()?.subtle;
  if (!subtle) {
    throw new Error(
      `${feature} requires WebCrypto AES-GCM. Use http://localhost, HTTPS, or disable secure alias mode.`,
    );
  }
  return subtle;
}

const catalogByIntent = new Map<string, IntentCatalogEntry>();

function rememberCatalog(entries: IntentCatalogEntry[]): void {
  for (const entry of entries) {
    if (entry?.intent) {
      catalogByIntent.set(entry.intent, entry);
    }
  }
}

function getCatalogEntry(intent: string): IntentCatalogEntry | undefined {
  return catalogByIntent.get(intent);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function encryptIntentToken(
  intent: string,
  capsuleId: string,
  intentSecret: string,
): Promise<string> {
  const keyBytes = base64UrlDecode(intentSecret.trim());
  if (keyBytes.length !== 32) {
    throw new Error("Intent Secret must decode to exactly 32 bytes");
  }

  const browserCrypto = getBrowserCrypto();
  if (!browserCrypto?.getRandomValues) {
    throw new Error("Secure intent alias mode requires crypto.getRandomValues");
  }
  const subtle = requireSubtleCrypto("Secure intent alias mode");
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = browserCrypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
      additionalData: textEncoder.encode(capsuleId),
    },
    cryptoKey,
    textEncoder.encode(intent),
  );

  const cipherBytes = new Uint8Array(cipherBuf);
  return base64UrlEncode(concatBytes([iv, cipherBytes]));
}

async function resolveWireIntent(
  intent: string,
  options: {
    secureAliasMode: boolean;
    capsuleId?: string;
    intentSecret?: string | null;
    forcePlainIntent?: boolean;
  },
): Promise<string> {
  if (options.forcePlainIntent || !options.secureAliasMode) {
    return intent;
  }

  if (isPassthroughIntent(intent)) {
    return intent;
  }

  const capsuleId = options.capsuleId?.trim() || "";
  if (!capsuleId) {
    throw new Error("Secure alias mode is enabled, but Capsule ID is missing");
  }

  const intentSecret = options.intentSecret?.trim();
  if (!intentSecret) {
    throw new Error(
      "Secure alias mode is enabled, but Intent Secret is missing",
    );
  }

  return encryptIntentToken(intent, capsuleId, intentSecret);
}

function resolveRequestUrl(targetUrl: string): {
  url: string;
  proxyTarget?: string;
} {
  if (
    typeof window === "undefined" ||
    typeof window.location === "undefined" ||
    !import.meta.env.DEV
  ) {
    return { url: targetUrl };
  }

  try {
    const resolvedTarget = new URL(targetUrl, window.location.href);
    if (resolvedTarget.origin === window.location.origin) {
      return { url: resolvedTarget.toString() };
    }
    return {
      url: new URL(DEV_PROXY_PATH, window.location.origin).toString(),
      proxyTarget: resolvedTarget.toString(),
    };
  } catch {
    return { url: targetUrl };
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryDecodeText(bytes: Uint8Array): string | null {
  try {
    return textDecoder.decode(bytes);
  } catch {
    return null;
  }
}

function isProbablyText(text: string): boolean {
  return !/[\u0000-\u0008\u000e-\u001f]/.test(text);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "").replace(/[\s-]/g, "");
  if (!clean || clean.length % 2 !== 0 || /[^a-f0-9]/i.test(clean)) {
    throw new Error("Invalid hex key");
  }
  return new Uint8Array(
    clean.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
}

function parsePrivateKeyHex(hex: string): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length === 32) return bytes;
  if (bytes.length > 32) return bytes.slice(-32);
  throw new Error("Unsupported private key length");
}

function safeActorIdToBytes(input: string | null | undefined): Uint8Array {
  if (!input) return EMPTY_16;
  try {
    return uuidToBytes(input);
  } catch {
    try {
      const bytes = hexToBytes(input);
      return bytes.length === 16 ? bytes : EMPTY_16;
    } catch {
      return EMPTY_16;
    }
  }
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findStringFieldDeep(
  root: unknown,
  acceptedKeys: Set<string>,
  maxDepth = 8,
): string | undefined {
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number): string | undefined => {
    if (depth > maxDepth || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "string") {
      return value.trim() ? value : undefined;
    }
    if (typeof value !== "object") {
      return undefined;
    }
    if (seen.has(value as object)) {
      return undefined;
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    for (const [key, entryValue] of Object.entries(value)) {
      if (acceptedKeys.has(normalizeFieldKey(key))) {
        const found = walk(entryValue, depth + 1);
        if (found) return found;
      }
    }

    for (const entryValue of Object.values(value)) {
      const found = walk(entryValue, depth + 1);
      if (found) return found;
    }

    return undefined;
  };

  return walk(root, 0);
}

function extractCapsuleBootstrapContext(response: unknown): {
  capsuleId?: string;
  intentSecret?: string;
} {
  const capsuleId = findStringFieldDeep(
    response,
    new Set(["capsuleid", "capsuleuid"]),
  );
  const intentSecret = findStringFieldDeep(
    response,
    new Set(["intentsecret", "capsulesecret"]),
  );

  return {
    capsuleId: capsuleId?.trim() || undefined,
    intentSecret: intentSecret?.trim() || undefined,
  };
}

function extractCapsule(source: unknown): unknown {
  if (!source || typeof source !== "object") {
    return source;
  }

  const record = source as Record<string, unknown>;
  return (
    record.capsule ||
    record.axisCapsule ||
    record.token ||
    (record.data as Record<string, unknown> | undefined)?.capsule ||
    source
  );
}

function extractCapsuleId(capsule: unknown): string | undefined {
  if (!capsule || typeof capsule !== "object") {
    return undefined;
  }

  const record = capsule as Record<string, unknown>;
  const payload = record.payload as Record<string, unknown> | undefined;
  const data = record.data as Record<string, unknown> | undefined;
  const id =
    record.id ||
    record.capsuleId ||
    record.capsule_id ||
    data?.id ||
    data?.capsuleId ||
    data?.capsule_id ||
    payload?.capsuleId ||
    payload?.capsule_id;

  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function extractCapsuleEncryptionKey(capsule: unknown): string | undefined {
  if (!capsule || typeof capsule !== "object") {
    return undefined;
  }

  const record = capsule as Record<string, unknown>;
  const payload = record.payload as Record<string, unknown> | undefined;
  const data = record.data as Record<string, unknown> | undefined;
  const key =
    record.encryptionKey ||
    record.encryption_key ||
    data?.encryptionKey ||
    data?.encryption_key ||
    payload?.encryptionKey ||
    payload?.encryption_key;

  return typeof key === "string" && key.length > 0 ? key : undefined;
}

function toCapsuleProof(source: unknown): unknown {
  const capsule = extractCapsule(source);
  const capsuleId = extractCapsuleId(capsule);
  if (!capsuleId) {
    return capsule;
  }

  const record =
    capsule && typeof capsule === "object"
      ? (capsule as Record<string, unknown>)
      : {};
  const payload = record.payload as Record<string, unknown> | undefined;

  return {
    ...record,
    payload: {
      ...(payload ?? {}),
      v: payload?.v ?? 1,
      capsuleId,
    },
  };
}

function capsuleProofRefToBytes(capsuleId: string): Uint8Array {
  const encoded = textEncoder.encode(capsuleId);
  if (encoded.length === 0 || encoded.length > 64) {
    throw new Error("Capsule ID is too long for AXIS proofRef");
  }
  return encoded;
}

function findObjectFieldDeep(
  root: unknown,
  acceptedKeys: Set<string>,
  maxDepth = 8,
): Record<string, unknown> | undefined {
  const seen = new WeakSet<object>();

  const walk = (
    value: unknown,
    depth: number,
  ): Record<string, unknown> | undefined => {
    if (depth > maxDepth || value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== "object") {
      return undefined;
    }
    if (seen.has(value as object)) {
      return undefined;
    }
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1);
        if (found) return found;
      }
      return undefined;
    }

    for (const [key, entryValue] of Object.entries(value)) {
      if (
        acceptedKeys.has(normalizeFieldKey(key)) &&
        entryValue &&
        typeof entryValue === "object" &&
        !Array.isArray(entryValue)
      ) {
        return entryValue as Record<string, unknown>;
      }
    }

    for (const entryValue of Object.values(value)) {
      const found = walk(entryValue, depth + 1);
      if (found) return found;
    }

    return undefined;
  };

  return walk(root, 0);
}

function extractAnonSessionContext(response: unknown): {
  sessionId?: string;
  challenge?: string;
  expiresAt?: string;
} {
  const sessionId = findStringFieldDeep(response, new Set(["sessionid"]));
  const challenge = findStringFieldDeep(response, new Set(["challenge"]));
  const expiresAt = findStringFieldDeep(response, new Set(["expiresat"]));

  return {
    sessionId: sessionId?.trim() || undefined,
    challenge: challenge?.trim() || undefined,
    expiresAt: expiresAt?.trim() || undefined,
  };
}

function extractAuthenticatedUser(response: unknown): AuthenticatedUser | null {
  const raw =
    findObjectFieldDeep(response, new Set(["userdata"])) ||
    findObjectFieldDeep(response, new Set(["user"]));
  if (!raw) return null;

  const id = raw.id;
  if (typeof id !== "string" || !id.trim()) {
    return null;
  }

  const read = (key: string): string | undefined =>
    typeof raw[key] === "string" && String(raw[key]).trim()
      ? String(raw[key]).trim()
      : undefined;

  return {
    id: id.trim(),
    username: read("username"),
    email: read("email"),
    full_name: read("full_name"),
    first_name: read("first_name"),
    last_name: read("last_name"),
    is_new_user: raw.is_new_user === true,
  };
}

function challengeToBytes(challenge: string): Uint8Array {
  const raw = challenge.trim();
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    return hexToBytes(raw);
  }
  return textEncoder.encode(raw);
}

function browserDeviceInfo() {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const navWithUA = nav as Navigator & {
    userAgentData?: { brands?: Array<{ brand: string }> };
  };
  const brandLabel = navWithUA.userAgentData?.brands
    ?.map((entry) => entry.brand)
    .filter(Boolean)
    .join(" ");
  const screenInfo =
    typeof window !== "undefined" ? window.screen : undefined;

  return {
    device_model: brandLabel || nav?.platform || "AXIS Studio Browser",
    os_version: nav?.userAgent || "Unknown",
    app_version: "AXIS_STUDIO_WEB",
    platform: nav?.platform || "web",
    screen_resolution: screenInfo
      ? `${screenInfo.width}x${screenInfo.height}`
      : "unknown",
    device_id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : undefined,
  };
}

async function digestToU64(input: string): Promise<string> {
  const hash = sha256(textEncoder.encode(input));
  let out = 0n;
  for (let i = 0; i < 8; i++) {
    out = (out << 8n) | BigInt(hash[i] ?? 0);
  }
  return out.toString();
}

function sanitizeHistoryValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeHistoryValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      const normalizedKey = normalizeFieldKey(key);
      if (
        typeof entryValue === "string" &&
        (normalizedKey === "base64" ||
          normalizedKey === "scriptfiletext" ||
          normalizedKey === "scripttext")
      ) {
        return [
          key,
          `[omitted ${normalizedKey} ${entryValue.length} chars for history]`,
        ];
      }
      return [key, sanitizeHistoryValue(entryValue)];
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toPositiveInt(value: unknown, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0
    ? Math.trunc(normalized)
    : fallback;
}

function isIntentFieldDoc(value: unknown): value is IntentFieldDoc {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.tag === "number" &&
    typeof value.kind === "string"
  );
}

function readFieldArray(value: unknown): IntentFieldDoc[] {
  return Array.isArray(value) ? value.filter(isIntentFieldDoc) : [];
}

function getCatalogBodyFields(
  entry?: IntentCatalogEntry | null,
): IntentFieldDoc[] {
  if (!entry) return [];

  const request = isRecord(entry.request) ? entry.request : undefined;
  const schema = isRecord(entry.schema) ? entry.schema : undefined;
  const inputSchema = isRecord(entry.inputSchema) ? entry.inputSchema : undefined;

  return [
    ...readFieldArray(entry.input),
    ...readFieldArray(entry.fields),
    ...readFieldArray(request?.input),
    ...readFieldArray(request?.fields),
    ...readFieldArray(schema?.fields),
    ...readFieldArray(inputSchema?.fields),
  ].filter((field, index, fields) => {
    if ((field.scope || "body") !== "body") return false;
    return fields.findIndex((f) => f.tag === field.tag) === index;
  });
}

function getCatalogBodyProfile(entry?: IntentCatalogEntry | null): string {
  const request = isRecord(entry?.request) ? entry?.request : undefined;
  const schema = isRecord(entry?.schema) ? entry?.schema : undefined;
  const inputSchema = isRecord(entry?.inputSchema) ? entry?.inputSchema : undefined;

  return (
    entry?.bodyProfile ||
    request?.bodyProfile ||
    (typeof schema?.bodyProfile === "string" ? schema.bodyProfile : "") ||
    (typeof inputSchema?.bodyProfile === "string"
      ? inputSchema.bodyProfile
      : "") ||
    ""
  );
}

function getFallbackBodyFields(intent: string): IntentFieldDoc[] {
  if (intent === "catalog.list") {
    return [{ name: "params", tag: 97, kind: "obj" }];
  }

  if (intent.endsWith(".page")) {
    return [{ name: "params", tag: 97, kind: "obj" }];
  }

  if (intent === "capsule.issue") {
    return [{ name: "intent", tag: 100, kind: "utf8" }];
  }

  if (intent === "auth.qr.login.scan") {
    return qrLoginBodyFields(false);
  }

  if (intent === "auth.qr.login.login") {
    return qrLoginBodyFields(true);
  }

  return [];
}

function qrLoginBodyFields(includeUsername: boolean): IntentFieldDoc[] {
  return [
    { name: "session_id", tag: 100, kind: "utf8" },
    { name: "device_fingerprint", tag: 101, kind: "u64" },
    { name: "web_device_fingerprint", tag: 102, kind: "u64" },
    { name: "device_public_key", tag: 103, kind: "utf8" },
    { name: "primary_public_key", tag: 104, kind: "utf8" },
    { name: "signature", tag: 105, kind: "utf8" },
    { name: "fcm_token", tag: 106, kind: "utf8" },
    { name: "primary_device_info", tag: 107, kind: "obj" },
    { name: "web_device_info", tag: 108, kind: "obj" },
    { name: "expires_at", tag: 109, kind: "utf8" },
    { name: "is_admin_login", tag: 110, kind: "bool" },
    ...(includeUsername ? [{ name: "username", tag: 111, kind: "utf8" }] : []),
  ];
}

function buildPaginationParams(input: Record<string, unknown>): {
  filter: Record<string, unknown>;
  sort: Record<string, unknown>;
  pagination: Record<string, unknown>;
} {
  const page = toPositiveInt(input.page, 1);
  const limit = toPositiveInt(input.limit ?? input.pageSize, 10);
  const rawFilter = isRecord(input.filter) ? input.filter : {};
  const rawPagination = isRecord(input.pagination) ? input.pagination : {};

  const filter: Record<string, unknown> = {
    ...rawFilter,
    page: toPositiveInt(rawFilter.page, page),
    limit: toPositiveInt(rawFilter.limit, limit),
  };

  if (Array.isArray(input.where)) filter.where = input.where;
  if (input.order_by !== undefined) filter.order_by = input.order_by;
  if (Array.isArray(input.relations)) filter.relations = input.relations;

  return {
    filter,
    sort: isRecord(input.sort) ? input.sort : {},
    pagination: {
      ...rawPagination,
      page,
      limit,
    },
  };
}

function normalizeBodyForFields(
  intent: string,
  body: unknown,
  fields: IntentFieldDoc[],
): Record<string, unknown> {
  if (!fields.length) return {};

  if (!isRecord(body)) {
    if (fields.length === 1) return { [fields[0].name]: body };
    return {};
  }

  const data: Record<string, unknown> = { ...body };
  const paramsField = fields.find((field) => field.name === "params");
  if (paramsField && data.params === undefined) {
    if (intent === "catalog.list") {
      data.params = {
        page: toPositiveInt(data.page, 1),
        pageSize: toPositiveInt(
          data.pageSize ?? data.limit,
          DEFAULT_CATALOG_PAGE_SIZE,
        ),
      };
    } else if (intent.endsWith(".page")) {
      data.params = buildPaginationParams(data);
    }
  }

  return data;
}

function encodeU64(value: unknown): Uint8Array {
  const buffer = new ArrayBuffer(8);
  const numberValue =
    typeof value === "bigint" ? value : BigInt(String(value ?? 0));
  new DataView(buffer).setBigUint64(0, numberValue, false);
  return new Uint8Array(buffer);
}

function encodeTlvValue(kind: string, value: unknown): Uint8Array {
  switch (kind) {
    case "utf8":
      return textEncoder.encode(String(value));
    case "u64":
      return encodeU64(value);
    case "bytes":
    case "bytes16":
      if (value instanceof Uint8Array) return value;
      return textEncoder.encode(String(value));
    case "bool":
      return new Uint8Array([value ? 1 : 0]);
    case "obj":
    case "arr":
      return textEncoder.encode(JSON.stringify(value));
    default:
      if (value instanceof Uint8Array) return value;
      return textEncoder.encode(String(value));
  }
}

function encodeTlvObject(
  intent: string,
  body: unknown,
  fields: IntentFieldDoc[],
): Uint8Array {
  const data = normalizeBodyForFields(intent, body, fields);
  const tlvs = fields.flatMap((field) => {
    const value = data[field.name];
    if (value === undefined || value === null) {
      if (field.required) {
        throw new Error(`Missing required TLV field: ${field.name}`);
      }
      return [];
    }

    return [
      {
        type: field.tag,
        value: encodeTlvValue(String(field.kind), value),
      },
    ];
  });

  return encodeTLVs(tlvs);
}

function encodeRawBody(body: unknown): Uint8Array {
  if (body === null || body === undefined) {
    return new Uint8Array();
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (typeof body === "string") {
    return textEncoder.encode(body);
  }
  return textEncoder.encode(JSON.stringify(body ?? {}));
}

function encodeIntentBody(
  intent: string,
  body: unknown,
  options: {
    metadata?: IntentCatalogEntry | null;
    bodyEncoding?: BodyEncodingSpec;
  } = {},
): {
  bytes: Uint8Array;
  isTLV: boolean;
} {
  const overrideFields = options.bodyEncoding?.fields ?? [];
  if (overrideFields.length > 0) {
    return {
      bytes: encodeTlvObject(intent, body, overrideFields),
      isTLV: true,
    };
  }

  const catalogFields = getCatalogBodyFields(options.metadata);
  const fields = catalogFields.length
    ? catalogFields
    : getFallbackBodyFields(intent);
  const bodyProfile = getCatalogBodyProfile(options.metadata);
  if (
    fields.length > 0 &&
    (!bodyProfile || bodyProfile === "TLV_MAP")
  ) {
    return {
      bytes: encodeTlvObject(intent, body, fields),
      isTLV: true,
    };
  }

  if (body === null || body === undefined) {
    return { bytes: new Uint8Array(), isTLV: false };
  }

  if (body instanceof Uint8Array) {
    return { bytes: body, isTLV: false };
  }

  return { bytes: encodeRawBody(body), isTLV: false };
}

function deriveCapsuleBodyKey(encryptionKey: string): Uint8Array {
  const trimmed = encryptionKey.trim().replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return hexToBytes(trimmed);
  }

  return sha256(textEncoder.encode(encryptionKey));
}

async function encryptCapsuleBody(
  body: Uint8Array,
  encryptionKey: string,
  options: { capsuleId?: string; bodyIsTlv?: boolean } = {},
): Promise<Uint8Array | undefined> {
  const browserCrypto = getBrowserCrypto();
  const subtle = browserCrypto?.subtle;
  if (!browserCrypto?.getRandomValues || !subtle) {
    return undefined;
  }

  const keyBytes = deriveCapsuleBodyKey(encryptionKey);
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = browserCrypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
      ...(options.capsuleId
        ? { additionalData: textEncoder.encode(options.capsuleId) }
        : {}),
    },
    cryptoKey,
    body,
  );
  const cipherAndTag = new Uint8Array(cipherBuf);
  const tag = cipherAndTag.slice(cipherAndTag.length - 16);
  const ciphertext = cipherAndTag.slice(0, cipherAndTag.length - 16);

  return textEncoder.encode(
    JSON.stringify({
      v: 1,
      alg: CAPSULE_BODY_ENCRYPTION_ALG,
      iv: base64Encode(iv),
      tag: base64Encode(tag),
      ciphertext: base64Encode(ciphertext),
      bodyIsTlv: options.bodyIsTlv ?? false,
    }),
  );
}

async function prepareFrameBody(
  encodedBody: { bytes: Uint8Array; isTLV: boolean },
  capsuleProof: unknown,
): Promise<{ bytes: Uint8Array; isTLV: boolean }> {
  const encryptionKey = extractCapsuleEncryptionKey(capsuleProof);
  const capsuleId = extractCapsuleId(capsuleProof);
  if (!capsuleProof || !encryptionKey) {
    return encodedBody;
  }

  const encryptedBody = await encryptCapsuleBody(
    encodedBody.bytes,
    encryptionKey,
    {
      capsuleId,
      bodyIsTlv: encodedBody.isTLV,
    },
  );
  if (!encryptedBody) {
    return encodedBody;
  }

  return {
    bytes: encryptedBody,
    isTLV: false,
  };
}

function readU64(bytes: Uint8Array): string {
  if (bytes.length !== 8) return bytesToHex(bytes);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(0, false).toString();
}

function proofTypeName(code: number | undefined): string {
  switch (code) {
    case ProofType.NONE:
      return "NONE";
    case ProofType.CAPSULE:
      return "CAPSULE";
    case ProofType.JWT:
      return "JWT";
    case ProofType.MTLS:
      return "MTLS";
    case ProofType.LOOM:
      return "LOOM";
    case ProofType.WITNESS:
      return "WITNESS";
    default:
      return `UNKNOWN_${code ?? "NA"}`;
  }
}

function flagNames(flags: number): string[] {
  const names: string[] = [];
  if (flags & FrameFlags.BODY_IS_TLV) names.push("BODY_IS_TLV");
  if (flags & FrameFlags.RECEIPT_CHAINING) names.push("RECEIPT_CHAINING");
  if (flags & FrameFlags.WITNESS_INCLUDED) names.push("WITNESS_INCLUDED");
  if (flags & FrameFlags.COMPRESSED) names.push("COMPRESSED");
  return names;
}

function headerName(tag: number): string {
  const name = TLVType[tag as unknown as keyof typeof TLVType];
  return typeof name === "string" ? name : `TAG_${tag}`;
}

function decodeHeaderValue(tag: number, bytes: Uint8Array): unknown {
  switch (tag) {
    case TLVType.PID:
    case TLVType.ACTOR_ID:
      return bytes.length === 16 ? bytesToUuid(bytes) : bytesToHex(bytes);
    case TLVType.TS:
      return readU64(bytes);
    case TLVType.INTENT:
    case TLVType.REALM:
    case TLVType.NODE:
    case TLVType.KID:
    case TLVType.EFFECT:
    case TLVType.ERROR_CODE:
    case TLVType.ERROR_MSG:
    case TLVType.NODE_KID: {
      const text = tryDecodeText(bytes);
      return text && isProbablyText(text) ? text : bytesToHex(bytes);
    }
    case TLVType.PROOF_TYPE:
      return { code: bytes[0] ?? null, label: proofTypeName(bytes[0]) };
    case TLVType.OK:
      return bytes[0] === 1;
    default: {
      const text = tryDecodeText(bytes);
      if (text && isProbablyText(text)) return text;
      return bytesToHex(bytes);
    }
  }
}

function decodeTlvCollection(bytes: Uint8Array) {
  const tlvs = decodeTLVs(bytes);
  return Array.from(tlvs.entries()).map(([tag, value]) => ({
    tag,
    name: headerName(tag),
    decoded: decodeHeaderValue(tag, value),
    rawHex: bytesToHex(value),
    byteLength: value.length,
  }));
}

function decodeAxisFrame(bytes: Uint8Array): AxisFrameLike {
  const magic = tryDecodeText(bytes.slice(0, 5));
  if (magic !== "AXIS1") {
    throw new Error("Invalid AXIS frame magic");
  }

  const version = bytes[5];
  if (version !== 1) {
    throw new Error(`Unsupported AXIS version: ${version}`);
  }

  const flags = bytes[6] ?? 0;
  let offset = 7;

  const hdrLenToken = decodeVarint(bytes, offset);
  const hdrLen = Number(hdrLenToken.value);
  offset = hdrLenToken.offset;

  const bodyLenToken = decodeVarint(bytes, offset);
  const bodyLen = Number(bodyLenToken.value);
  offset = bodyLenToken.offset;

  const sigLenToken = decodeVarint(bytes, offset);
  const sigLen = Number(sigLenToken.value);
  offset = sigLenToken.offset;

  const end = offset + hdrLen + bodyLen + sigLen;
  if (end > bytes.length) {
    throw new Error("AXIS frame truncated");
  }

  const headerBytes = bytes.slice(offset, offset + hdrLen);
  offset += hdrLen;

  const body = bytes.slice(offset, offset + bodyLen);
  offset += bodyLen;

  const sig = bytes.slice(offset, offset + sigLen);

  return {
    flags,
    headers: decodeTLVs(headerBytes),
    body,
    sig,
  };
}

function decodeBody(bytes: Uint8Array, flags: number) {
  if (!bytes.length) {
    return { format: "empty", byteLength: 0, parsed: null };
  }

  if (flags & FrameFlags.BODY_IS_TLV) {
    try {
      return {
        format: "tlv",
        byteLength: bytes.length,
        parsed: decodeTlvCollection(bytes),
      };
    } catch (error) {
      return {
        format: "tlv",
        byteLength: bytes.length,
        error: error instanceof Error ? error.message : "TLV decode failed",
        rawHex: bytesToHex(bytes),
      };
    }
  }

  const text = tryDecodeText(bytes);
  if (text !== null && isProbablyText(text)) {
    const json = safeParseJson(text);
    if (json !== undefined) {
      return {
        format: "json",
        byteLength: bytes.length,
        parsed: json,
        text,
      };
    }
    return {
      format: "text",
      byteLength: bytes.length,
      parsed: text,
      text,
    };
  }

  return {
    format: "binary",
    byteLength: bytes.length,
    parsed: { hex: bytesToHex(bytes) },
    rawHex: bytesToHex(bytes),
  };
}

function getHeaderText(
  headers: Map<number, Uint8Array>,
  tag: number,
): string | undefined {
  const value = headers.get(tag);
  if (!value) return undefined;
  const text = tryDecodeText(value);
  return text && isProbablyText(text) ? text : undefined;
}

function buildAxisFrameView(
  frameBytes: Uint8Array,
  options: {
    direction: "request" | "response";
    endpoint?: string;
    http?: Record<string, unknown>;
    fallbackIntent?: string;
  },
): ProtocolSnapshot {
  const frame = decodeAxisFrame(frameBytes);
  const body = decodeBody(frame.body, frame.flags);

  return {
    transport: "axis-bin",
    raw: truncateRaw(formatHex(frameBytes)),
    tree: {
      direction: options.direction,
      transport: "axis-bin",
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options.http ? { http: options.http } : {}),
      intent:
        options.fallbackIntent ??
        getHeaderText(frame.headers, TLVType.INTENT) ??
        null,
      frame: {
        version: 1,
        byteLength: frameBytes.length,
        flags: {
          value: frame.flags,
          names: flagNames(frame.flags),
        },
        headers: Array.from(frame.headers.entries()).map(([tag, value]) => ({
          tag,
          name: headerName(tag),
          decoded: decodeHeaderValue(tag, value),
          rawHex: bytesToHex(value),
          byteLength: value.length,
        })),
        body,
        signature: {
          present: frame.sig.length > 0,
          byteLength: frame.sig.length,
          hex: frame.sig.length ? bytesToHex(frame.sig) : null,
        },
      },
    },
  };
}

function buildRequestSnapshot(
  frameBytes: Uint8Array,
  intent: string,
  targetUrl: string,
  body: unknown,
  requestHeaders: Record<string, string>,
): ProtocolSnapshot {
  const snapshot = buildAxisFrameView(frameBytes, {
    direction: "request",
    endpoint: targetUrl,
    fallbackIntent: intent,
    http: {
      method: "POST",
      url: targetUrl,
      headers: requestHeaders,
    },
  });

  return {
    ...snapshot,
    tree: {
      ...(snapshot.tree as Record<string, unknown>),
      payload: body ?? null,
    },
  };
}

function responseTransportForJson(
  json: Record<string, unknown>,
): SnapshotTransport {
  if (json.ver === "cce-v1" && "response_id" in json) return "cce-response";
  if (json.ver === "cce-v1" && "request_id" in json && "error" in json)
    return "cce-error";
  return "json";
}

function buildPlainResponseSnapshot(
  buffer: Uint8Array,
  status: number,
  headers: Record<string, string>,
): {
  body: any;
  raw: string;
  effect: string;
  snapshot: ProtocolSnapshot;
} {
  const text = tryDecodeText(buffer);

  if (text !== null && isProbablyText(text)) {
    const json = safeParseJson(text);
    if (json !== undefined && json && typeof json === "object") {
      const transport = responseTransportForJson(
        json as Record<string, unknown>,
      );
      const effect = extractEffect(json, status);
      return {
        body: json,
        raw: truncateRaw(text),
        effect,
        snapshot: {
          transport,
          raw: truncateRaw(text),
          tree: {
            transport,
            http: {
              status,
              ok: status >= 200 && status < 300,
              headers,
            },
            envelope: json,
          },
        },
      };
    }

    return {
      body: text,
      raw: truncateRaw(text),
      effect: status >= 400 ? "ERROR" : "COMPLETE",
      snapshot: {
        transport: "text",
        raw: truncateRaw(text),
        tree: {
          transport: "text",
          http: {
            status,
            ok: status >= 200 && status < 300,
            headers,
          },
          body: text,
        },
      },
    };
  }

  const rawHex = formatHex(buffer);
  return {
    body: { hex: bytesToHex(buffer) },
    raw: truncateRaw(rawHex),
    effect: status >= 400 ? "ERROR" : "BINARY",
    snapshot: {
      transport: "binary",
      raw: truncateRaw(rawHex),
      tree: {
        transport: "binary",
        http: {
          status,
          ok: status >= 200 && status < 300,
          headers,
        },
        byteLength: buffer.length,
        hex: bytesToHex(buffer),
      },
    },
  };
}

function extractAxisBody(frame: AxisFrameLike): any {
  const body = decodeBody(frame.body, frame.flags);
  return body.parsed ?? null;
}

function extractEffect(
  body: any,
  status?: number,
  frame?: AxisFrameLike,
): string {
  const headerEffect = frame
    ? getHeaderText(frame.headers, TLVType.EFFECT)
    : undefined;
  if (headerEffect) return headerEffect;

  if (body && typeof body === "object") {
    const objectBody = body as Record<string, any>;
    if (typeof objectBody.effect === "string") return objectBody.effect;
    if (typeof objectBody.status === "string") return objectBody.status;
    if (typeof objectBody.code === "string") return objectBody.code;
    if (
      objectBody.result &&
      typeof objectBody.result === "object" &&
      typeof objectBody.result.effect === "string"
    ) {
      return objectBody.result.effect;
    }
    if (
      objectBody.error &&
      typeof objectBody.error === "object" &&
      typeof objectBody.error.code === "string"
    ) {
      return objectBody.error.code;
    }
  }

  if (status !== undefined && status >= 400) return "ERROR";
  return "COMPLETE";
}

function decodeResponseBuffer(
  buffer: Uint8Array,
  status: number,
  headers: Record<string, string>,
): {
  body: any;
  raw: string;
  effect: string;
  snapshot: ProtocolSnapshot;
} {
  if (buffer.length >= 5) {
    const magic = tryDecodeText(buffer.slice(0, 5));
    if (magic === "AXIS1") {
      const frame = decodeAxisFrame(buffer);
      const body = extractAxisBody(frame);
      return {
        body,
        raw: truncateRaw(formatHex(buffer)),
        effect: extractEffect(body, status, frame),
        snapshot: buildAxisFrameView(buffer, {
          direction: "response",
          http: {
            status,
            ok: status >= 200 && status < 300,
            headers,
          },
        }),
      };
    }
  }

  return buildPlainResponseSnapshot(buffer, status, headers);
}

/* ── main send ───────────────────────────────────────────── */

interface SendIntentOptions {
  recordHistory?: boolean;
  forcePlainIntent?: boolean;
  skipCapsuleBootstrap?: boolean;
  skipAutoCapsule?: boolean;
  metadata?: IntentCatalogEntry | null;
  bodyEncoding?: BodyEncodingSpec;
  capsule?: unknown | false;
  headers?: Record<string, string>;
}

export interface BrowserLoginResult {
  anonSession: unknown;
  sessionId: string;
  challenge: string;
  fingerprint: string;
  isAdminLogin: boolean;
  user: AuthenticatedUser | null;
  loginResponse: SendResult;
}

async function ensureCapsuleContext(
  targetUrl: string,
): Promise<{ capsuleId: string; intentSecret?: string }> {
  const auth = useAuthStore();
  const existingCapsuleId = auth.capsuleId?.trim() || "";
  const existingIntentSecret = auth.intentSecret?.trim() || "";
  if (existingCapsuleId && existingIntentSecret) {
    return {
      capsuleId: existingCapsuleId,
      intentSecret: existingIntentSecret,
    };
  }

  const actorId = auth.actorId?.trim() || "";
  const bootstrapBody = actorId
    ? {
        actor_id: actorId,
        actorId,
      }
    : {};

  const errors: string[] = [];

  for (const bootstrapIntent of CAPSULE_BOOTSTRAP_INTENTS) {
    const res = await sendIntent(bootstrapIntent, bootstrapBody, targetUrl, {
      recordHistory: false,
      forcePlainIntent: true,
      skipCapsuleBootstrap: true,
    });

    if (!res.ok) {
      errors.push(
        `${bootstrapIntent}: ${res.effect || `HTTP_${res.status || 0}`}`,
      );
      continue;
    }

    const context = extractCapsuleBootstrapContext(res.response);
    if (!context.capsuleId) {
      errors.push(`${bootstrapIntent}: response missing capsule id`);
      continue;
    }

    auth.setCapsuleId(context.capsuleId);
    if (context.intentSecret) {
      auth.setIntentSecret(context.intentSecret);
    }

    return context;
  }

  throw new Error(
    `Secure alias bootstrap failed: ${errors[0] || "unable to obtain capsule context"}`,
  );
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalized = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === normalized);
}

function withDefaultAuthHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const auth = useAuthStore();
  const merged = { ...(headers || {}) };
  const token = auth.bearerToken?.trim();
  if (token && !hasHeader(merged, "Authorization")) {
    merged.Authorization = token.toLowerCase().startsWith("bearer ")
      ? token
      : `Bearer ${token}`;
  }
  return merged;
}

function requiresProof(
  metadata: IntentCatalogEntry | null | undefined,
  proof: string,
): boolean {
  return (metadata?.requiredProof || []).some(
    (entry) => entry.toUpperCase() === proof,
  );
}

function requiresCapsuleProof(
  intent: string,
  metadata: IntentCatalogEntry | null | undefined,
): boolean {
  return (
    requiresProof(metadata, "CAPSULE") ||
    (!metadata && FALLBACK_CAPSULE_INTENTS.has(intent))
  );
}

function setFrameHeader(
  builder: AxisFrameBuilder,
  tag: number,
  value: Uint8Array,
): void {
  const writableBuilder = builder as AxisFrameBuilder & {
    setHeader?: (type: number, value: Uint8Array) => AxisFrameBuilder;
    headers?: Map<number, Uint8Array>;
  };

  if (typeof writableBuilder.setHeader === "function") {
    writableBuilder.setHeader(tag, value);
    return;
  }

  if (writableBuilder.headers instanceof Map) {
    writableBuilder.headers.set(tag, value);
    return;
  }

  throw new Error("AXIS frame builder cannot attach extension headers");
}

async function issueCapsuleForIntent(
  targetIntent: string,
  targetUrl: string,
  headers: Record<string, string>,
): Promise<unknown> {
  const capsuleIssueMeta = getCatalogEntry("capsule.issue");
  const capsuleIssueFields = getCatalogBodyFields(capsuleIssueMeta);
  const res = await sendIntent(
    "capsule.issue",
    { intent: targetIntent },
    targetUrl,
    {
      recordHistory: false,
      forcePlainIntent: true,
      skipCapsuleBootstrap: true,
      skipAutoCapsule: true,
      metadata: capsuleIssueMeta,
      bodyEncoding: {
        fields: capsuleIssueFields.length
          ? capsuleIssueFields
          : [{ name: "intent", tag: 100, kind: "utf8" }],
      },
      headers,
    },
  );

  if (!res.ok) {
    throw new Error(
      `capsule.issue failed for ${targetIntent}: ${res.effect || res.status}`,
    );
  }

  const proof = toCapsuleProof(res.response);
  if (!extractCapsuleId(proof)) {
    throw new Error("capsule.issue response did not include a capsule id");
  }
  return proof;
}

async function resolveCapsuleProof(
  intent: string,
  targetUrl: string,
  metadata: IntentCatalogEntry | null | undefined,
  options: SendIntentOptions | undefined,
  headers: Record<string, string>,
): Promise<unknown | undefined> {
  if (options?.capsule === false || options?.skipAutoCapsule) {
    return undefined;
  }

  if (options?.capsule) {
    return toCapsuleProof(options.capsule);
  }

  if (!requiresCapsuleProof(intent, metadata)) {
    return undefined;
  }

  return issueCapsuleForIntent(intent, targetUrl, headers);
}

export async function loginWithActiveKey(
  username?: string,
  nodeUrlOverride?: string,
): Promise<BrowserLoginResult> {
  const auth = useAuthStore();
  const activeKey = auth.getActiveKey();
  if (!activeKey?.privateKeyHex || !activeKey.publicKeyHex) {
    throw new Error("Generate or select an active Ed25519 key first");
  }

  const deviceInfo = browserDeviceInfo();
  const fingerprintSeed = [
    deviceInfo.device_model,
    deviceInfo.os_version,
    deviceInfo.platform,
    deviceInfo.screen_resolution,
  ].join("|");
  const fingerprint = await digestToU64(`axis-studio:${fingerprintSeed}`);

  const anonSessionRes = await sendIntent(
    "auth.anon.session",
    {},
    nodeUrlOverride,
    {
      forcePlainIntent: true,
      skipCapsuleBootstrap: true,
      headers: { "x-fingerprint": fingerprint },
    },
  );

  if (!anonSessionRes.ok) {
    throw new Error(
      `auth.anon.session failed: ${anonSessionRes.effect || anonSessionRes.status}`,
    );
  }

  const anonSession = extractAnonSessionContext(anonSessionRes.response);
  if (!anonSession.sessionId || !anonSession.challenge) {
    throw new Error("Anonymous session response is missing session data");
  }

  const signature = bytesToHex(
    await ed.signAsync(
      challengeToBytes(anonSession.challenge),
      parsePrivateKeyHex(activeKey.privateKeyHex),
    ),
  );
  const primaryFingerprint = await digestToU64(
    `primary:${activeKey.publicKeyHex}:${fingerprintSeed}`,
  );
  const webFingerprint = await digestToU64(
    `web:${activeKey.publicKeyHex}:${fingerprintSeed}`,
  );
  const trimmedUsername = username?.trim() || "";
  const isAdminLogin = trimmedUsername.toLowerCase().endsWith("-admin");
  const loginIntent = isAdminLogin
    ? "auth.qr.login.login"
    : "auth.qr.login.scan";
  const loginBody: Record<string, unknown> = {
    session_id: anonSession.sessionId,
    device_fingerprint: primaryFingerprint,
    web_device_fingerprint: webFingerprint,
    device_public_key: activeKey.publicKeyHex,
    primary_public_key: activeKey.publicKeyHex,
    signature,
    primary_device_info: deviceInfo,
    web_device_info: deviceInfo,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (isAdminLogin) {
    loginBody.username = trimmedUsername;
  }

  const loginResponse = await sendIntent(
    loginIntent,
    loginBody,
    nodeUrlOverride,
    {
      forcePlainIntent: true,
      skipCapsuleBootstrap: true,
    },
  );

  if (!loginResponse.ok) {
    throw new Error(
      `${loginIntent} failed: ${loginResponse.effect || loginResponse.status}`,
    );
  }

  const user = extractAuthenticatedUser(loginResponse.response);
  if (user?.id) {
    auth.setAuthenticatedUser(user);
    auth.setActorId(user.id);
  }

  return {
    anonSession: anonSessionRes.response,
    sessionId: anonSession.sessionId,
    challenge: anonSession.challenge,
    fingerprint,
    isAdminLogin,
    user,
    loginResponse,
  };
}

export async function sendIntent(
  intent: string,
  body: unknown = {},
  nodeUrlOverride?: string,
  options?: SendIntentOptions,
): Promise<SendResult> {
  const conn = useConnectionStore();
  const auth = useAuthStore();
  const history = useHistoryStore();

  const pid = generatePid();
  const nonce = generateNonce(32);
  const actorId = safeActorIdToBytes(auth.actorId);
  const targetUrl = (nodeUrlOverride || conn.nodeUrl).replace(/\/+$/, "");
  const { url: requestUrl, proxyTarget } = resolveRequestUrl(targetUrl);
  const metadata = options?.metadata ?? getCatalogEntry(intent) ?? null;
  const baseHeaders = withDefaultAuthHeaders(options?.headers);
  const secureAliasMode =
    auth.secureIntentAliasMode === true && options?.forcePlainIntent !== true;

  let capsuleId = auth.capsuleId?.trim() || "";
  let intentSecret = auth.intentSecret?.trim() || "";

  if (
    secureAliasMode &&
    !isPassthroughIntent(intent) &&
    !options?.skipCapsuleBootstrap &&
    (!capsuleId || !intentSecret)
  ) {
    const bootstrap = await ensureCapsuleContext(targetUrl);
    capsuleId = bootstrap.capsuleId?.trim() || capsuleId;
    intentSecret = bootstrap.intentSecret?.trim() || intentSecret;
  }

  let capsuleProof = await resolveCapsuleProof(
    intent,
    targetUrl,
    metadata,
    options,
    baseHeaders,
  );

  const proofCapsuleId = extractCapsuleId(capsuleProof);
  capsuleId = proofCapsuleId || capsuleId;
  const hasCapsule = Boolean(proofCapsuleId);
  const proofRef =
    hasCapsule && proofCapsuleId
      ? capsuleProofRefToBytes(proofCapsuleId)
      : EMPTY_16;
  const wireIntent = await resolveWireIntent(intent, {
    secureAliasMode,
    capsuleId,
    intentSecret,
    forcePlainIntent: options?.forcePlainIntent,
  });
  const encodedBody = encodeIntentBody(intent, body, {
    metadata,
    bodyEncoding: options?.bodyEncoding,
  });
  const frameBody = await prepareFrameBody(encodedBody, capsuleProof);

  const builder = new AxisFrameBuilder()
    .setPid(pid)
    .setTimestamp(BigInt(Date.now()))
    .setIntent(wireIntent)
    .setActorId(actorId)
    .setProofType(hasCapsule ? ProofType.CAPSULE : ProofType.NONE)
    .setProofRef(proofRef)
    .setNonce(nonce)
    .setBody(frameBody.bytes)
    .setFlags(frameBody.isTLV, false, false);

  if (capsuleProof) {
    setFrameHeader(
      builder,
      TLV_CAPSULE,
      textEncoder.encode(JSON.stringify(capsuleProof)),
    );
  }

  const activeKey = auth.getActiveKey();
  const signFrame = shouldSignFrame(intent, metadata, hasCapsule);
  let frameBytes: Uint8Array;

  if (signFrame && activeKey?.privateKeyHex) {
    const privKey = parsePrivateKeyHex(activeKey.privateKeyHex);
    const unsigned = builder.buildUnsigned();
    const sig = await ed.signAsync(unsigned, privKey);
    frameBytes = builder.buildSigned(sig);
  } else {
    frameBytes = builder.buildUnsigned();
  }

  const requestHeaders = {
    "Content-Type": AxisMediaTypes.BINARY,
    Accept: AxisMediaTypes.CLIENT_ACCEPT,
    ...(proxyTarget ? { [DEV_PROXY_TARGET_HEADER]: proxyTarget } : {}),
    ...baseHeaders,
  };
  if (proofCapsuleId && !hasHeader(requestHeaders, "capsule")) {
    requestHeaders.capsule = proofCapsuleId;
  }
  const requestSnapshot = buildRequestSnapshot(
    frameBytes,
    intent,
    targetUrl,
    body,
    requestHeaders,
  );

  const start = performance.now();
  let result: SendResult;

  try {
    const res = await fetch(requestUrl, {
      method: "POST",
      headers: requestHeaders,
      body: frameBytes as BodyInit,
      signal: AbortSignal.timeout(30_000),
    });

    const durationMs = Math.round(performance.now() - start);
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const buffer = new Uint8Array(await res.arrayBuffer());
    const decoded = decodeResponseBuffer(buffer, res.status, responseHeaders);

    result = {
      ok: res.ok,
      status: res.status,
      durationMs,
      response: decoded.body,
      raw: decoded.raw,
      effect: decoded.effect,
      requestSnapshot,
      responseSnapshot: decoded.snapshot,
      responseHeaders,
    };
  } catch (error: any) {
    const durationMs = Math.round(performance.now() - start);
    const message = error?.message || "Request failed";
    result = {
      ok: false,
      status: 0,
      durationMs,
      response: { error: message },
      raw: message,
      effect: "ERROR",
      requestSnapshot,
      responseSnapshot: {
        transport: "text",
        raw: message,
        tree: {
          transport: "text",
          http: { status: 0, ok: false, headers: {} },
          error: message,
        },
      },
      responseHeaders: {},
    };
  }

  if (options?.recordHistory !== false) {
    history.push({
      id: bytesToHex(pid),
      ts: Date.now(),
      intent,
      requestBody: safeStringify(sanitizeHistoryValue(body)),
      responseBody: safeStringify(result.response),
      responseEffect: result.effect,
      durationMs: result.durationMs,
      status: result.ok ? "ok" : "error",
      nodeUrl: targetUrl,
      httpStatus: result.status,
      requestSnapshot: {
        transport: result.requestSnapshot.transport,
        tree: result.requestSnapshot.tree,
        raw: truncateRaw(result.requestSnapshot.raw),
      },
      responseSnapshot: {
        transport: result.responseSnapshot.transport,
        tree: result.responseSnapshot.tree,
        raw: truncateRaw(result.responseSnapshot.raw),
      },
    });
  }

  return result;
}

/* ── catalog helpers ─────────────────────────────────────── */

export async function fetchCatalog(): Promise<IntentCatalogEntry[]> {
  const res = await sendIntent(
    "catalog.list",
    {
      params: {
        page: 1,
        pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      },
    },
    undefined,
    {
      bodyEncoding: {
        fields: [{ name: "params", tag: 97, kind: "obj" }],
      },
    },
  );
  const entries = (
    res.ok ? res.response?.intents || res.response?.docs || [] : []
  ) as IntentCatalogEntry[];
  rememberCatalog(entries);
  return entries;
}

export async function describeIntent(
  intent: string,
): Promise<IntentCatalogEntry | null> {
  const res = await sendIntent("catalog.describe", intent);
  const definition = (res.ok
    ? res.response?.definition || null
    : null) as IntentCatalogEntry | null;
  if (definition) rememberCatalog([definition]);
  return definition;
}

export async function searchCatalog(query: string): Promise<IntentCatalogEntry[]> {
  const res = await sendIntent("catalog.search", query);
  const entries = (
    res.ok ? res.response?.intents || res.response?.docs || [] : []
  ) as IntentCatalogEntry[];
  rememberCatalog(entries);
  return entries;
}
