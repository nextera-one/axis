import { TlvField, TlvEnum } from '../../../decorators/tlv-field.decorator';
import { AxisTlvDto } from '../../../base/axis-tlv.dto';
import { HashAlgoEnum } from '../enums/hash_algo.enum';
import { HashScopeEnum } from '../enums/hash_scope.enum';
import { SeverityEnum } from '../enums/severity.enum';

export class CreateAxisPacketDenylistDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  active: boolean;

  @TlvField(101, { kind: 'utf8', maxLen: 128 })
  actor_id?: string;

  @TlvField(102, { kind: 'u64' })
  expires_at?: bigint;

  @TlvField(103, { kind: 'u64', required: true })
  first_seen_at: bigint;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(HashAlgoEnum))
  hash_algo: HashAlgoEnum;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(HashScopeEnum))
  hash_scope: HashScopeEnum;

  @TlvField(106, { kind: 'u64', required: true })
  hit_count: bigint;

  @TlvField(107, { kind: 'utf8', maxLen: 256 })
  intent?: string;

  @TlvField(108, { kind: 'u64' })
  last_seen_at?: bigint;

  @TlvField(109, { kind: 'obj', maxLen: 4096 })
  metadata?: Record<string, unknown>;

  @TlvField(110, { kind: 'bytes', required: true, maxLen: 256 })
  packet_hash: Uint8Array;

  @TlvField(111, { kind: 'utf8', required: true, maxLen: 512 })
  reason: string;

  @TlvField(112, { kind: 'utf8', required: true, maxLen: 32 })
  @TlvEnum(Object.values(SeverityEnum))
  severity: SeverityEnum;
}
