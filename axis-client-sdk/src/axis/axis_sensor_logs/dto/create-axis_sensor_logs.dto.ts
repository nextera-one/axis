import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { DecisionEnum } from '../enums/decision.enum';

export class CreateAxisSensorLogsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', maxLen: 128 })
  actor_id?: string;

  @TlvField(101, { kind: 'utf8', maxLen: 128 })
  correlation_id?: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(DecisionEnum))
  decision: DecisionEnum;

  @TlvField(103, { kind: 'u64' })
  frame_size?: bigint;

  @TlvField(104, { kind: 'utf8', maxLen: 256 })
  intent?: string;

  @TlvField(105, { kind: 'utf8', maxLen: 64 })
  ip_address?: string;

  @TlvField(106, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;

  @TlvField(107, { kind: 'utf8', maxLen: 512 })
  reason?: string;

  @TlvField(108, { kind: 'utf8', required: true, maxLen: 128 })
  sensor_name: string;

  @TlvField(109, { kind: 'u64', required: true })
  ts: bigint;
}
