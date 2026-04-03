import { AxisTlvDto } from '../base/axis-tlv.dto';
import { TlvField } from '../decorators/tlv-field.decorator';

export class PaymentsCreateChargeReqDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 512 })
  token: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 64 })
  amount: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 8 })
  currency: string;

  @TlvField(103, { kind: 'utf8', maxLen: 500 })
  description?: string;

  @TlvField(104, { kind: 'utf8', maxLen: 100 })
  customerEmail?: string;

  @TlvField(105, { kind: 'utf8', maxLen: 50 })
  customerFirstName?: string;

  @TlvField(106, { kind: 'utf8', maxLen: 50 })
  customerLastName?: string;

  @TlvField(107, { kind: 'utf8', maxLen: 20 })
  customerPhoneCountryCode?: string;

  @TlvField(108, { kind: 'utf8', maxLen: 20 })
  customerPhoneNumber?: string;

  @TlvField(109, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, string>;
}

export class PaymentsGetChargeReqDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  chargeId: string;
}

export class PaymentsWebhookReqDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  id: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  object: string;

  @TlvField(102, { kind: 'bool' })
  liveMode?: boolean;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 128 })
  type: string;

  @TlvField(104, { kind: 'obj', required: true, maxLen: 8192 })
  data: Record<string, unknown>;

  @TlvField(105, { kind: 'u64' })
  created?: bigint;
}

export class PaymentsChargeResDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 256 })
  chargeId: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 32 })
  status: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 64 })
  amount: string;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 8 })
  currency: string;

  @TlvField(104, { kind: 'utf8', maxLen: 2048 })
  redirectUrl?: string;

  @TlvField(105, { kind: 'utf8', maxLen: 512 })
  message?: string;
}

export class PaymentsWebhookResDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  received: boolean;
}