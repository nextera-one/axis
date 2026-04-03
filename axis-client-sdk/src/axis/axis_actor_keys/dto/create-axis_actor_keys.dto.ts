import { TlvField, TlvEnum, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { AlgorithmEnum } from '../enums/algorithm.enum';
import { PurposeEnum } from '../enums/purpose.enum';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisActorKeysDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 64 })
  @TlvMinLen(1, 'actor_id must not be empty')
  actor_id: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(AlgorithmEnum))
  algorithm: AlgorithmEnum;

  @TlvField(102, { kind: 'u64' })
  expires_at?: bigint;

  @TlvField(103, { kind: 'bool', required: true })
  is_primary: boolean;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'key_id must not be empty')
  key_id: string;

  @TlvField(105, { kind: 'bytes', maxLen: 4096 })
  metadata?: Uint8Array;

  @TlvField(106, { kind: 'u64' })
  not_before?: bigint;

  @TlvField(107, { kind: 'bytes', required: true, maxLen: 256 })
  @TlvMinLen(16, 'public_key too short')
  public_key: Uint8Array;

  @TlvField(108, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(PurposeEnum))
  purpose: PurposeEnum;

  @TlvField(109, { kind: 'utf8', maxLen: 512 })
  revocation_reason?: string;

  @TlvField(110, { kind: 'u64' })
  revoked_at?: bigint;

  @TlvField(111, { kind: 'utf8', maxLen: 128 })
  rotated_from_key_id?: string;

  @TlvField(112, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;
}
