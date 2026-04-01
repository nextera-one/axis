import { TlvField } from '../decorators/tlv-field.decorator';
import { AxisTlvDto } from './axis-tlv.dto';

/**
 * Reserved TLV body tags for server-generated response fields.
 *
 * Tags 1–10 are reserved for system/audit fields in response bodies.
 * Entity-specific fields start at tag 100+.
 */
export const RESPONSE_TAG_ID = 1;
export const RESPONSE_TAG_CREATED_AT = 2;
export const RESPONSE_TAG_UPDATED_AT = 3;
export const RESPONSE_TAG_CREATED_BY = 4;
export const RESPONSE_TAG_UPDATED_BY = 5;

/**
 * AxisResponseDto — Base class for outbound TLV response bodies.
 *
 * Server-generated audit fields that the backend appends to every
 * entity response. These are NEVER sent by the client — they flow
 * server → client only.
 *
 * Timestamps are u64 Unix milliseconds (same as TLV_TS in headers).
 */
export abstract class AxisResponseDto extends AxisTlvDto {
  @TlvField(RESPONSE_TAG_ID, { kind: 'utf8' })
  id?: string;

  @TlvField(RESPONSE_TAG_CREATED_AT, { kind: 'u64' })
  created_at?: bigint;

  @TlvField(RESPONSE_TAG_UPDATED_AT, { kind: 'u64' })
  updated_at?: bigint;

  @TlvField(RESPONSE_TAG_CREATED_BY, { kind: 'utf8' })
  created_by?: string;

  @TlvField(RESPONSE_TAG_UPDATED_BY, { kind: 'utf8' })
  updated_by?: string;
}
