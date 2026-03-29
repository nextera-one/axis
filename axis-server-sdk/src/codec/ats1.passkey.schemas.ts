import { ATS1_HDR, ATS1_SCHEMA } from './ats1.constants';
import * as ats1 from './ats1';

/**
 * Build canonical hdr for any request using ATS1 codec.
 */
export function buildAts1Hdr(params: {
  intentId: number;
  schemaId: number;
  actorKeyId?: Buffer;
  capsuleId?: Buffer;
  traceId?: Buffer;
  tsMs?: bigint;
  nonce?: Buffer;
  bodyHash?: Buffer;
}): Buffer {
  const hdr: ats1.AxisHeaderLogical = {
    intentId: params.intentId,
    schemaId: params.schemaId,
    actorKeyId: params.actorKeyId ?? Buffer.alloc(0),
    capsuleId: params.capsuleId,
    nonce: params.nonce ?? require('crypto').randomBytes(16),
    tsMs: params.tsMs ?? BigInt(Date.now()),
    bodyHash: params.bodyHash ?? Buffer.alloc(32),
    traceId: params.traceId,
  };

  const tlvs = ats1.encodeAxisHeaderToTLVs(hdr);
  return ats1.encodeTLVStreamCanonical(tlvs);
}

/**
 * PASSKEY: login.options.req
 * schema 2001 body:
 *  - (1) username: utf8
 */
export function packPasskeyLoginOptionsReq(params: {
  intentId: number;
  username: string;
  actorKeyId?: Buffer;
  capsuleId?: Buffer;
  traceId?: Buffer;
}) {
  const bodyTlvs = ats1.logicalBodyToTLVs(
    ats1.Schema2001_PasskeyLoginOptionsReq,
    {
      schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_OPTIONS_REQ,
      fields: { username: params.username },
    },
  );
  const body = ats1.encodeTLVStreamCanonical(bodyTlvs);
  const bodyHash = ats1.sha256(body);

  const hdr = buildAts1Hdr({
    intentId: params.intentId,
    schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_OPTIONS_REQ,
    actorKeyId: params.actorKeyId,
    capsuleId: params.capsuleId,
    traceId: params.traceId,
    bodyHash,
  });

  return { hdr, body };
}

export function unpackPasskeyLoginOptionsReq(body: Buffer) {
  const tlvs = ats1.decodeTLVStream(body);
  const decoded = ats1.tlvsToLogicalBody(
    ats1.Schema2001_PasskeyLoginOptionsReq,
    tlvs,
  );
  return { username: decoded.fields.username as string };
}

/**
 * Defined schemas for passkey operations
 */
export const Schema2021_PasskeyRegisterOptionsReq: ats1.Ats1SchemaDescriptor = {
  schemaId: ATS1_SCHEMA.PASSKEY_REGISTER_OPTIONS_REQ,
  name: 'axis.auth.passkey.register.options.req',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'username', type: 'utf8', required: true, maxLen: 128 },
  ],
};

export const Schema2011_PasskeyLoginVerifyReq: ats1.Ats1SchemaDescriptor = {
  schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_VERIFY_REQ,
  name: 'axis.auth.passkey.login.verify.req',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'username', type: 'utf8', required: true, maxLen: 128 },
    {
      tag: 2,
      name: 'credentialId',
      type: 'bytes',
      required: true,
      maxLen: 1024,
    },
    {
      tag: 3,
      name: 'clientDataJSON',
      type: 'bytes',
      required: true,
      maxLen: 4096,
    },
    {
      tag: 4,
      name: 'authenticatorData',
      type: 'bytes',
      required: true,
      maxLen: 1024,
    },
    { tag: 5, name: 'signature', type: 'bytes', required: true, maxLen: 1024 },
    { tag: 6, name: 'userHandle', type: 'bytes', required: false, maxLen: 128 },
  ],
};

/**
 * PASSKEY: register.options.req
 */
export function packPasskeyRegisterOptionsReq(params: {
  intentId: number;
  username: string;
  actorKeyId?: Buffer;
  traceId?: Buffer;
}) {
  const bodyTlvs = ats1.logicalBodyToTLVs(
    Schema2021_PasskeyRegisterOptionsReq,
    {
      schemaId: ATS1_SCHEMA.PASSKEY_REGISTER_OPTIONS_REQ,
      fields: { username: params.username },
    },
  );
  const body = ats1.encodeTLVStreamCanonical(bodyTlvs);
  const bodyHash = ats1.sha256(body);

  const hdr = buildAts1Hdr({
    intentId: params.intentId,
    schemaId: ATS1_SCHEMA.PASSKEY_REGISTER_OPTIONS_REQ,
    actorKeyId: params.actorKeyId,
    traceId: params.traceId,
    bodyHash,
  });

  return { hdr, body };
}

export function unpackPasskeyRegisterOptionsReq(body: Buffer) {
  const tlvs = ats1.decodeTLVStream(body);
  const decoded = ats1.tlvsToLogicalBody(
    Schema2021_PasskeyRegisterOptionsReq,
    tlvs,
  );
  return { username: decoded.fields.username as string };
}

/**
 * PASSKEY: login.verify.req
 */
export function packPasskeyLoginVerifyReq(params: {
  intentId: number;
  username: string;
  credentialId: Buffer;
  clientDataJSON: Buffer;
  authenticatorData: Buffer;
  signature: Buffer;
  userHandle?: Buffer;
  actorKeyId?: Buffer;
  traceId?: Buffer;
}) {
  const bodyTlvs = ats1.logicalBodyToTLVs(Schema2011_PasskeyLoginVerifyReq, {
    schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_VERIFY_REQ,
    fields: {
      username: params.username,
      credentialId: params.credentialId,
      clientDataJSON: params.clientDataJSON,
      authenticatorData: params.authenticatorData,
      signature: params.signature,
      userHandle: params.userHandle,
    },
  });

  const body = ats1.encodeTLVStreamCanonical(bodyTlvs);
  const bodyHash = ats1.sha256(body);

  const hdr = buildAts1Hdr({
    intentId: params.intentId,
    schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_VERIFY_REQ,
    actorKeyId: params.actorKeyId,
    traceId: params.traceId,
    bodyHash,
  });

  return { hdr, body };
}

export function unpackPasskeyLoginVerifyReq(body: Buffer) {
  const tlvs = ats1.decodeTLVStream(body);
  const decoded = ats1.tlvsToLogicalBody(
    Schema2011_PasskeyLoginVerifyReq,
    tlvs,
  );
  const f = decoded.fields;

  return {
    username: f.username as string,
    credentialId: f.credentialId as Buffer,
    clientDataJSON: f.clientDataJSON as Buffer,
    authenticatorData: f.authenticatorData as Buffer,
    signature: f.signature as Buffer,
    userHandle: f.userHandle as Buffer | undefined,
  };
}

// ========================================
// Response Schemas
// ========================================

/**
 * Schema 2002: Passkey Login Options Response
 * - (1) challenge: bytes
 * - (2) timeout: uvarint (ms)
 * - (3) rpId: utf8
 * - (4) allowCredentials: bytes (nested TLV array, each item is id+type+transports)
 * - (5) userVerification: utf8
 */
export const Schema2002_PasskeyLoginOptionsRes: ats1.Ats1SchemaDescriptor = {
  schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_OPTIONS_RES,
  name: 'axis.auth.passkey.login.options.res',
  strict: false, // allow extra fields from WebAuthn library
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'challenge', type: 'utf8', required: true }, // base64url string
    { tag: 2, name: 'timeout', type: 'uvarint', required: false },
    { tag: 3, name: 'rpId', type: 'utf8', required: false },
    { tag: 4, name: 'userVerification', type: 'utf8', required: false },
    { tag: 5, name: 'allowCredentialsJson', type: 'utf8', required: false }, // JSON array for simplicity
  ],
};

export function packPasskeyLoginOptionsRes(params: {
  challenge: string;
  timeout?: number;
  rpId?: string;
  userVerification?: string;
  allowCredentials?: { id: string; type: string; transports?: string[] }[];
}): Buffer {
  const fields: Record<string, any> = {
    challenge: params.challenge,
  };
  if (params.timeout !== undefined) fields.timeout = params.timeout;
  if (params.rpId) fields.rpId = params.rpId;
  if (params.userVerification)
    fields.userVerification = params.userVerification;
  if (params.allowCredentials)
    fields.allowCredentialsJson = JSON.stringify(params.allowCredentials);

  const bodyTlvs = ats1.logicalBodyToTLVs(Schema2002_PasskeyLoginOptionsRes, {
    schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_OPTIONS_RES,
    fields,
  });
  return ats1.encodeTLVStreamCanonical(bodyTlvs);
}

/**
 * Schema 2012: Passkey Login Verify Response
 * - (1) actorId: utf8
 * - (2) keyId: utf8 (credentialId base64url)
 * - (3) capsule: bytes
 * - (4) expiresAt: u64be (ms)
 */
export const Schema2012_PasskeyLoginVerifyRes: ats1.Ats1SchemaDescriptor = {
  schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_VERIFY_RES,
  name: 'axis.auth.passkey.login.verify.res',
  strict: true,
  maxNestingDepth: 4,
  fields: [
    { tag: 1, name: 'actorId', type: 'utf8', required: true, maxLen: 256 },
    { tag: 2, name: 'keyId', type: 'utf8', required: true, maxLen: 256 },
    { tag: 3, name: 'capsule', type: 'bytes', required: true, maxLen: 4096 },
    { tag: 4, name: 'expiresAt', type: 'u64be', required: true },
  ],
};

export function packPasskeyLoginVerifyRes(params: {
  actorId: string;
  keyId: string;
  capsule: Buffer;
  expiresAt: bigint;
}): Buffer {
  const bodyTlvs = ats1.logicalBodyToTLVs(Schema2012_PasskeyLoginVerifyRes, {
    schemaId: ATS1_SCHEMA.PASSKEY_LOGIN_VERIFY_RES,
    fields: {
      actorId: params.actorId,
      keyId: params.keyId,
      capsule: params.capsule,
      expiresAt: params.expiresAt,
    },
  });
  return ats1.encodeTLVStreamCanonical(bodyTlvs);
}
