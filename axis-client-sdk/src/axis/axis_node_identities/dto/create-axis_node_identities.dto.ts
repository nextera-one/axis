import { TlvField, TlvEnum, TlvMinLen } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisNodeIdentitiesDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', maxLen: 4096 })
  certificate?: string;

  @TlvField(101, { kind: 'u64' })
  expires_at?: bigint;

  @TlvField(102, { kind: 'u64', required: true })
  issued_at: bigint;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'node_id must not be empty')
  node_id: string;

  @TlvField(104, { kind: 'bytes', required: true, maxLen: 256 })
  public_key: Uint8Array;

  @TlvField(105, { kind: 'bytes', maxLen: 256 })
  root_cert_hash?: Uint8Array;

  @TlvField(106, { kind: 'bytes', maxLen: 512 })
  seed_encrypted?: Uint8Array;

  @TlvField(107, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;
}
