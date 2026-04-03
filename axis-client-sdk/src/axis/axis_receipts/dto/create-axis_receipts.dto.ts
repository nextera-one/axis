import { TlvField, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisReceiptsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'actor_id must not be empty')
  actor_id: string;

  @TlvField(101, { kind: 'u64', required: true })
  chain_index: bigint;

  @TlvField(102, { kind: 'bytes', required: true, maxLen: 256 })
  current_hash: Uint8Array;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 64 })
  effect: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 256 })
  intent: string;

  @TlvField(105, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;

  @TlvField(106, { kind: 'bytes', required: true, maxLen: 128 })
  pid: Uint8Array;

  @TlvField(107, { kind: 'bytes', maxLen: 256 })
  prev_hash?: Uint8Array;

  @TlvField(108, { kind: 'utf8', required: true, maxLen: 128 })
  rid: string;

  @TlvField(109, { kind: 'u64', required: true })
  ts: bigint;

  @TlvField(110, { kind: 'bool', required: true })
  verified: boolean;
}
