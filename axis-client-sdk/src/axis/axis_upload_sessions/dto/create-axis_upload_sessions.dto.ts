import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisUploadSessionsDto extends AxisTlvDto {
  @TlvField(100, { kind: 'u64', required: true })
  chunk_size: bigint;

  @TlvField(101, { kind: 'u64' })
  expires_at?: bigint;

  @TlvField(102, { kind: 'bytes', required: true, maxLen: 128 })
  file_id: Uint8Array;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 512 })
  filename: string;

  @TlvField(104, { kind: 'bytes', maxLen: 512 })
  hash_state?: Uint8Array;

  @TlvField(105, { kind: 'utf8', maxLen: 128 })
  mime_type?: string;

  @TlvField(106, { kind: 'u64', required: true })
  received_bitmap: bigint;

  @TlvField(107, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;

  @TlvField(108, { kind: 'u64', required: true })
  total_chunks: bigint;

  @TlvField(109, { kind: 'u64', required: true })
  total_size: bigint;

  @TlvField(110, { kind: 'u64', required: true })
  version: bigint;
}
