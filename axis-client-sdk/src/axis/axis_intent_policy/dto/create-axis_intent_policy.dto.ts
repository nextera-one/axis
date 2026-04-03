import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { VisibilityEnum } from '../enums/visibility.enum';

export class CreateAxisIntentPolicyDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  canonical_tlv: boolean;

  @TlvField(101, { kind: 'bool', required: true })
  enabled: boolean;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 256 })
  intent: string;

  @TlvField(103, { kind: 'u64', required: true })
  max_body_bytes: bigint;

  @TlvField(104, { kind: 'u64', required: true })
  max_header_bytes: bigint;

  @TlvField(105, { kind: 'u64', required: true })
  max_tlvs: bigint;

  @TlvField(106, { kind: 'bool', required: true })
  replay_enabled: boolean;

  @TlvField(107, { kind: 'u64', required: true })
  replay_nonce_ttl_s: bigint;

  @TlvField(108, { kind: 'u64', required: true })
  replay_skew_ms: bigint;

  @TlvField(109, { kind: 'bool', required: true })
  require_capsule: boolean;

  @TlvField(110, { kind: 'bool', required: true })
  require_mtls: boolean;

  @TlvField(111, { kind: 'bool', required: true })
  require_passport: boolean;

  @TlvField(112, { kind: 'bool', required: true })
  signed_receipt: boolean;

  @TlvField(113, { kind: 'u64', required: true })
  timeout_ms: bigint;

  @TlvField(114, { kind: 'u64', required: true })
  version: bigint;

  @TlvField(115, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(VisibilityEnum))
  visibility: VisibilityEnum;
}
