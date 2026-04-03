/**
 * Sensor Execution Bands
 *
 * Semantic groupings for the AXIS sensor chain.
 * Each band has 50–100 slots for ordering sensors within it.
 *
 * WIRE     (0–39):   Raw bytes, no decode. PRE_DECODE phase.
 * IDENTITY (40–89):  Who is this? IP, access, proof, capsule. POST_DECODE.
 * POLICY   (90–139): Are they allowed? Sig, capability, rate limit. POST_DECODE.
 * CONTENT  (140–199): What's in the frame? TLV, body, schema, files. POST_DECODE.
 * BUSINESS (200–299): Business context. Stream, WS, timeout. POST_DECODE.
 * AUDIT    (900+):   Finalization, logging. POST_DECODE.
 */
export const BAND = {
  /** Pre-decode: raw byte validation, geo, budget, magic */
  WIRE: 0,
  /** Post-decode: identity resolution, capsule, proof */
  IDENTITY: 40,
  /** Post-decode: authorization, signature, rate limiting */
  POLICY: 90,
  /** Post-decode: content validation, TLV, schema, files */
  CONTENT: 140,
  /** Post-decode: business logic sensors, streams, WS */
  BUSINESS: 200,
  /** Post-decode: audit, logging (always last) */
  AUDIT: 900,
} as const;

export type SensorBand = keyof typeof BAND;

/** Sensors with order below this boundary run in PRE_DECODE phase (middleware) */
export const PRE_DECODE_BOUNDARY = 40;
