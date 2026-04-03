import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { OwnerTypeEnum } from '../enums/owner_type.enum';
import { RiskLevelEnum } from '../enums/risk_level.enum';
import { StatusEnum } from '../enums/status.enum';
import { VisibilityEnum } from '../enums/visibility.enum';

export class CreateAxisIntentsRegistryDto extends AxisTlvDto {
  @TlvField(100, { kind: 'u64', required: true })
  current_version: bigint;

  @TlvField(101, { kind: 'u64', required: true })
  default_timeout_ms: bigint;

  @TlvField(102, { kind: 'utf8', maxLen: 512 })
  description?: string;

  @TlvField(103, { kind: 'utf8', maxLen: 512 })
  docs_url?: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 256 })
  intent: string;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 128 })
  owner_id: string;

  @TlvField(106, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(OwnerTypeEnum))
  owner_type: OwnerTypeEnum;

  @TlvField(107, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(RiskLevelEnum))
  risk_level: RiskLevelEnum;

  @TlvField(108, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;

  @TlvField(109, { kind: 'obj', maxLen: 2048 })
  tags?: Record<string, unknown>;

  @TlvField(110, { kind: 'utf8', required: true, maxLen: 256 })
  title: string;

  @TlvField(111, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(VisibilityEnum))
  visibility: VisibilityEnum;
}
