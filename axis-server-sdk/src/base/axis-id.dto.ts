import { TlvField, TlvMinLen } from '../decorators/tlv-field.decorator';
import { AxisTlvDto } from './axis-tlv.dto';

export class AxisIdDto extends AxisTlvDto {
  @TlvField(1, { kind: 'utf8', required: true, maxLen: 128 })
  @TlvMinLen(1, 'id must not be empty')
  id!: string;
}
