import { TlvField, TlvEnum, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { IdentityStatusEnum } from '../enums/identity-status.enum';

export class CreateAxisIdentityDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'actor_id must not be empty')
  actor_id: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'identity_uid must not be empty')
  identity_uid: string;

  @TlvField(102, { kind: 'utf8', maxLen: 256 })
  display_name?: string;

  @TlvField(103, { kind: 'utf8', maxLen: 32 })
  @TlvEnum(Object.values(IdentityStatusEnum))
  status?: IdentityStatusEnum;

  @TlvField(104, { kind: 'utf8', maxLen: 256 })
  email?: string;

  @TlvField(105, { kind: 'utf8', maxLen: 32 })
  phone?: string;

  @TlvField(106, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;
}
