import { TlvField, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisStreamEventsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  actor_id: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'event_id must not be empty')
  event_id: string;

  @TlvField(102, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;

  @TlvField(103, { kind: 'bytes', required: true, maxLen: 65536 })
  payload: Uint8Array;

  @TlvField(104, { kind: 'u64', required: true })
  published_at: bigint;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 128 })
  stream_id: string;

  @TlvField(106, { kind: 'utf8', required: true, maxLen: 256 })
  topic: string;
}
