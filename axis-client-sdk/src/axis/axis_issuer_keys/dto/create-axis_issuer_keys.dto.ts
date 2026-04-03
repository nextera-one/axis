import { TlvField, TlvEnum, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { KeyTypeEnum } from '../enums/key_type.enum';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisIssuerKeysDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'issuer_id must not be empty')
  issuer_id: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'key_id must not be empty')
  key_id: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(KeyTypeEnum))
  key_type: KeyTypeEnum;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 512 })
  public_key: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 128 })
  fingerprint: string;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;

  @TlvField(106, { kind: 'u64' })
  not_before?: bigint;

  @TlvField(107, { kind: 'u64' })
  not_after?: bigint;

  @TlvField(108, { kind: 'u64' })
  rotated_at?: bigint;

  @TlvField(109, { kind: 'u64' })
  revoked_at?: bigint;

  @TlvField(110, { kind: 'utf8', maxLen: 512 })
  revoke_reason?: string;

  @TlvField(111, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;
}
