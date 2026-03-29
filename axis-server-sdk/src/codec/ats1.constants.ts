// ats1.constants.ts

// Header TLV tags (hdr TLVs)
export const ATS1_HDR = {
  INTENT_ID: 1, // uvarint
  ACTOR_KEY_ID: 2, // bytes (key fingerprint / credentialId hash)
  CAPSULE_ID: 3, // bytes or varint
  NONCE: 4, // 16 bytes
  TS_MS: 5, // u64be (8)
  SCHEMA_ID: 6, // uvarint
  BODY_HASH: 7, // 32 bytes (sha256)
  TRACE_ID: 8, // 16 bytes
} as const;

// Schema IDs (body TLVs meaning depends on schema)
export const ATS1_SCHEMA = {
  PASSKEY_LOGIN_OPTIONS_REQ: 2001,
  PASSKEY_LOGIN_OPTIONS_RES: 2002,

  PASSKEY_LOGIN_VERIFY_REQ: 2011,
  PASSKEY_LOGIN_VERIFY_RES: 2012,

  PASSKEY_REGISTER_OPTIONS_REQ: 2021,
  PASSKEY_REGISTER_OPTIONS_RES: 2022,

  PASSKEY_REGISTER_VERIFY_REQ: 2031,
  PASSKEY_REGISTER_VERIFY_RES: 2032,
} as const;
