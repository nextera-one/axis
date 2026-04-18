export {
  AXIS_MAGIC,
  AXIS_VERSION,
  MAX_HDR_LEN,
  MAX_BODY_LEN,
  MAX_SIG_LEN,
  MAX_FRAME_LEN,
  FLAG_BODY_TLV,
  FLAG_CHAIN_REQ,
  FLAG_HAS_WITNESS,
  TLV_PID,
  TLV_TS,
  TLV_INTENT,
  TLV_ACTOR_ID,
  TLV_PROOF_TYPE,
  TLV_PROOF_REF,
  TLV_NONCE,
  TLV_AUD,
  TLV_REALM,
  TLV_NODE,
  TLV_TRACE_ID,
  TLV_KID,
  TLV_RID,
  TLV_OK,
  TLV_EFFECT,
  TLV_ERROR_CODE,
  TLV_ERROR_MSG,
  TLV_PREV_HASH,
  TLV_RECEIPT_HASH,
  TLV_NODE_KID,
  TLV_NODE_CERT_HASH,
  TLV_LOOM_PRESENCE_ID,
  TLV_LOOM_WRIT,
  TLV_LOOM_THREAD_HASH,
  TLV_UPLOAD_ID,
  TLV_INDEX,
  TLV_OFFSET,
  TLV_SHA256_CHUNK,
  TLV_CAPSULE,
  TLV_BODY_OBJ,
  TLV_BODY_ARR,
  NCERT_NODE_ID,
  NCERT_KID,
  NCERT_ALG,
  NCERT_PUB,
  NCERT_NBF,
  NCERT_EXP,
  NCERT_SCOPE,
  NCERT_ISSUER_KID,
  NCERT_PAYLOAD,
  NCERT_SIG,
  PROOF_NONE,
  PROOF_CAPSULE,
  PROOF_JWT,
  PROOF_MTLS,
  PROOF_LOOM,
  PROOF_WITNESS,
  ProofType,
  BodyProfile,
  ERR_INVALID_PACKET,
  ERR_BAD_SIGNATURE,
  ERR_REPLAY_DETECTED,
  ERR_CONTRACT_VIOLATION,
} from '@nextera.one/axis-protocol';

export abstract class AxisMediaTypes {
  static readonly BINARY = 'application/axis-bin';
  static readonly OCTET_STREAM = 'application/octet-stream';
  static readonly LEGACY_BINARY = 'application/x-axis';

  static readonly VALID_AXIS_CONTENT_TYPES = [
    AxisMediaTypes.BINARY,
    AxisMediaTypes.OCTET_STREAM,
    AxisMediaTypes.LEGACY_BINARY,
  ] as const;

  static normalize(value?: string | null): string | undefined {
    if (!value) return undefined;
    return value.split(';', 1)[0].trim().toLowerCase();
  }

  static isAxisContentType(value?: string | null): boolean {
    const normalized = AxisMediaTypes.normalize(value);
    return (
      !!normalized &&
      AxisMediaTypes.VALID_AXIS_CONTENT_TYPES.some(
        (contentType) => contentType === normalized,
      )
    );
  }
}
