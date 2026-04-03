import { TlvField } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisMetricsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'obj', maxLen: 2048 })
  labels?: Record<string, unknown>;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  metric_name: string;

  @TlvField(102, { kind: 'u64', required: true })
  metric_value: bigint;

  @TlvField(103, { kind: 'utf8', maxLen: 128 })
  node_id?: string;

  @TlvField(104, { kind: 'u64', required: true })
  ts: bigint;
}
