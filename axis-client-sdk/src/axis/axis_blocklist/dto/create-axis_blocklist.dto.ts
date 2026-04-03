import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { TypeEnum } from '../enums/type.enum';

export class CreateAxisBlocklistDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  active: boolean;

  @TlvField(101, { kind: 'u64', required: true })
  blocked_at: bigint;

  @TlvField(102, { kind: 'utf8', maxLen: 128 })
  blocked_by?: string;

  @TlvField(103, { kind: 'u64' })
  expires_at?: bigint;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 512 })
  reason: string;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 64 })
  @TlvEnum(Object.values(TypeEnum))
  type: TypeEnum;

  @TlvField(106, { kind: 'utf8', required: true, maxLen: 256 })
  value: string;
}
