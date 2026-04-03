import { TlvField, TlvEnum, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisTracesDto extends AxisTlvDto {
  @TlvField(100, { kind: 'u64', required: true })
  duration_ms: bigint;

  @TlvField(101, { kind: 'obj', maxLen: 8192 })
  logs?: Record<string, unknown>;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 256 })
  operation_name: string;

  @TlvField(103, { kind: 'utf8', maxLen: 128 })
  parent_span_id?: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'span_id must not be empty')
  span_id: string;

  @TlvField(105, { kind: 'u64', required: true })
  start_time: bigint;

  @TlvField(106, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;

  @TlvField(107, { kind: 'obj', maxLen: 4096 })
  tags?: Record<string, unknown>;

  @TlvField(108, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'trace_id must not be empty')
  trace_id: string;
}
