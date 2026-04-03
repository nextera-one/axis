import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { StatusEnum } from '../enums/status.enum';

export class CreateAxisRootCertificatesDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bytes', required: true, maxLen: 256 })
  cert_hash: Uint8Array;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 8192 })
  certificate: string;

  @TlvField(102, { kind: 'u64', required: true })
  issued_at: bigint;

  @TlvField(103, { kind: 'bytes', required: true, maxLen: 256 })
  public_key: Uint8Array;

  @TlvField(104, { kind: 'u64' })
  revoked_at?: bigint;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(StatusEnum))
  status: StatusEnum;
}
