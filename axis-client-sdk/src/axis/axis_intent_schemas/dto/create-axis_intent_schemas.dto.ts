import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { BodyProfileEnum } from '../enums/body_profile.enum';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisIntentSchemasDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(BodyProfileEnum))
  body_profile: BodyProfileEnum;

  @TlvField(101, { kind: 'obj', required: true, maxLen: 4096 })
  body_schema: Record<string, unknown>;

  @TlvField(102, { kind: 'utf8', maxLen: 512 })
  description?: string;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 256 })
  intent: string;

  @TlvField(104, { kind: 'u64', required: true })
  max_body_size: bigint;

  @TlvField(105, { kind: 'u64', required: true })
  max_depth: bigint;

  @TlvField(106, { kind: 'u64', required: true })
  max_frame_size: bigint;

  @TlvField(107, { kind: 'u64', required: true })
  max_header_size: bigint;

  @TlvField(108, { kind: 'u64', required: true })
  max_items: bigint;

  @TlvField(109, { kind: 'obj', maxLen: 2048 })
  required_proofs?: Record<string, unknown>;

  @TlvField(110, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;

  @TlvField(111, { kind: 'u64', required: true })
  version: bigint;
}
