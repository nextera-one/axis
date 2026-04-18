export const AXIS_MAGIC = new Uint8Array([0x41, 0x58, 0x49, 0x53, 0x31]); // AXIS1 (5 bytes)
export const AXIS_VERSION = 0x01;

// Hard limits (Frozen Canon)
export const MAX_HDR_LEN = 2048;
export const MAX_BODY_LEN = 65536;
export const MAX_SIG_LEN = 128;
export const MAX_FRAME_LEN = 70 * 1024; // 70 KB

// Packet Flags
export const FLAG_BODY_TLV = 0x01;
export const FLAG_CHAIN_REQ = 0x02;
export const FLAG_HAS_WITNESS = 0x04;

// TLV Types (Header)
export const TLV_PID = 1;
export const TLV_TS = 2;
export const TLV_INTENT = 3;
export const TLV_ACTOR_ID = 4;
export const TLV_PROOF_TYPE = 5;
export const TLV_PROOF_REF = 6;
export const TLV_NONCE = 7;
export const TLV_AUD = 8;
export const TLV_REALM = TLV_AUD;
export const TLV_NODE = 9;
export const TLV_TRACE_ID = 10;
export const TLV_KID = 11;

// TLV Types (Receipt)
export const TLV_RID = 15;
export const TLV_OK = 16;
export const TLV_EFFECT = 17;
export const TLV_ERROR_CODE = 18;
export const TLV_ERROR_MSG = 19;
export const TLV_PREV_HASH = 20;
export const TLV_RECEIPT_HASH = 21;
export const TLV_NODE_KID = 30;
export const TLV_NODE_CERT_HASH = 34;

// TLV Types (Loom Runtime - Lawful Execution)
export const TLV_LOOM_PRESENCE_ID = 91;
export const TLV_LOOM_WRIT = 92;
export const TLV_LOOM_THREAD_HASH = 93;

// TLV Types (Application Extensions)
export const TLV_UPLOAD_ID = 70;
export const TLV_INDEX = 71;
export const TLV_OFFSET = 72;
export const TLV_SHA256_CHUNK = 73;
export const TLV_CAPSULE = 90;

// TLV Types (Body Structure)
export const TLV_BODY_OBJ = 254;
export const TLV_BODY_ARR = 255;

// TLV Types (Node Certificate payload)
export const NCERT_NODE_ID = 1;
export const NCERT_KID = 2;
export const NCERT_ALG = 3;
export const NCERT_PUB = 4;
export const NCERT_NBF = 5;
export const NCERT_EXP = 6;
export const NCERT_SCOPE = 7;
export const NCERT_ISSUER_KID = 8;
export const NCERT_PAYLOAD = 50;
export const NCERT_SIG = 51;

// Proof Types
export const PROOF_NONE = 0;
export const PROOF_CAPSULE = 1;
export const PROOF_JWT = 2;
export const PROOF_MTLS = 3;
export const PROOF_LOOM = 4;
export const PROOF_WITNESS = 5;

export enum ProofType {
  NONE = 0,
  CAPSULE = 1,
  JWT = 2,
  MTLS = 3,
  LOOM = 4,
  WITNESS = 5,
}

export enum BodyProfile {
  RAW = 0,
  TLV_MAP = 1,
  OBJ = 2,
  ARR = 3,
}

// Error Codes
export const ERR_INVALID_PACKET = 'INVALID_PACKET';
export const ERR_BAD_SIGNATURE = 'BAD_SIGNATURE';
export const ERR_REPLAY_DETECTED = 'REPLAY_DETECTED';
export const ERR_CONTRACT_VIOLATION = 'CONTRACT_VIOLATION';

export abstract class AxisMediaTypes {
  static readonly BINARY = 'application/axis-bin';
  static readonly OCTET_STREAM = 'application/octet-stream';
  static readonly LEGACY_BINARY = 'application/x-axis';
  static readonly JSON = 'application/json';
  static readonly TEXT = 'text/plain';

  static readonly CLIENT_ACCEPT = [
    AxisMediaTypes.BINARY,
    AxisMediaTypes.JSON,
    AxisMediaTypes.TEXT,
  ].join(', ');

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
