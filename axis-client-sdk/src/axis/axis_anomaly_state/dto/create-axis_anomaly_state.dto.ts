import { TlvField } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisAnomalyStateDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  actor_id: string;

  @TlvField(101, { kind: 'u64', required: true })
  anomaly_score: bigint;

  @TlvField(102, { kind: 'bool', required: true })
  blocked: boolean;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 128 })
  intent: string;

  @TlvField(104, { kind: 'u64', required: true })
  request_count: bigint;

  @TlvField(105, { kind: 'u64', required: true })
  window_end: bigint;

  @TlvField(106, { kind: 'u64', required: true })
  window_start: bigint;
}
