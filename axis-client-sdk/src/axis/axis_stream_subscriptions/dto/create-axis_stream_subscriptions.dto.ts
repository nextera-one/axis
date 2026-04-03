import { TlvField, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisStreamSubscriptionsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  active: boolean;

  @TlvField(101, { kind: 'utf8', maxLen: 128 })
  last_event_id?: string;

  @TlvField(102, { kind: 'u64' })
  last_read_at?: bigint;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'subscriber_id must not be empty')
  subscriber_id: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 256 })
  topic: string;
}
