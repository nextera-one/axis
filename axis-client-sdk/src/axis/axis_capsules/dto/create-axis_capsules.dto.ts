import { TlvField } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';

export class CreateAxisCapsulesDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  active: boolean;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  actor_id: string;

  @TlvField(102, { kind: 'obj', required: true, maxLen: 2048 })
  allowed_intents: Record<string, unknown>;

  @TlvField(103, { kind: 'bool', required: true })
  decay_enabled: boolean;

  @TlvField(104, { kind: 'obj', maxLen: 1024 })
  decay_policy?: Record<string, unknown>;

  @TlvField(105, { kind: 'utf8', maxLen: 512 })
  description?: string;

  @TlvField(106, { kind: 'u64', required: true })
  expires_at: bigint;

  @TlvField(107, { kind: 'utf8', maxLen: 128 })
  issued_by?: string;

  @TlvField(108, { kind: 'u64' })
  last_used_at?: bigint;

  @TlvField(109, { kind: 'obj', required: true, maxLen: 2048 })
  limits: Record<string, unknown>;

  @TlvField(110, { kind: 'obj', maxLen: 1024 })
  scope?: Record<string, unknown>;

  @TlvField(111, { kind: 'u64', required: true })
  tier: bigint;

  @TlvField(112, { kind: 'u64', required: true })
  usage_count: bigint;

  @TlvField(113, { kind: 'utf8', maxLen: 64 })
  status?: string;

  @TlvField(114, { kind: 'utf8', maxLen: 128 })
  capsule_id?: string;

  @TlvField(115, { kind: 'u64' })
  exp?: bigint;

  @TlvField(116, { kind: 'u64' })
  nbf?: bigint;

  @TlvField(117, { kind: 'u64' })
  used_count?: bigint;

  @TlvField(118, { kind: 'u64' })
  max_uses?: bigint;

  @TlvField(119, { kind: 'utf8', maxLen: 64 })
  mode?: string;

  @TlvField(120, { kind: 'bytes', maxLen: 512 })
  payload_hash?: Uint8Array;

  @TlvField(121, { kind: 'utf8', maxLen: 64 })
  sig_alg?: string;

  @TlvField(122, { kind: 'utf8', maxLen: 128 })
  sig_kid?: string;

  @TlvField(123, { kind: 'bytes', maxLen: 4096 })
  sig_value?: Uint8Array;

  @TlvField(124, { kind: 'utf8', maxLen: 128 })
  intent?: string;

  @TlvField(125, { kind: 'utf8', maxLen: 256 })
  audience?: string;

  @TlvField(126, { kind: 'utf8', maxLen: 256 })
  issuer?: string;

  @TlvField(127, { kind: 'utf8', maxLen: 256 })
  subject?: string;

  @TlvField(128, { kind: 'u64' })
  iat?: bigint;

  @TlvField(129, { kind: 'obj', maxLen: 2048 })
  scopes_json?: Record<string, unknown>;

  @TlvField(130, { kind: 'obj', maxLen: 2048 })
  constraints_json?: Record<string, unknown>;

  @TlvField(131, { kind: 'obj', maxLen: 2048 })
  policy_refs_json?: Record<string, unknown>;

  @TlvField(132, { kind: 'u64' })
  risk_score?: bigint;
}
