import { AxisTlvDto } from '../base/axis-tlv.dto';
import { TlvField } from '../decorators/tlv-field.decorator';

export class QrChallengeRequestDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', maxLen: 512 })
  origin?: string;

  @TlvField(101, { kind: 'utf8', maxLen: 64 })
  ipAddress?: string;

  @TlvField(102, { kind: 'u64' })
  ttlSeconds?: bigint;
}

export class QrChallengeResponseDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  ok: boolean;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 128 })
  challengeUid: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 128 })
  tickAuthChallengeUid: string;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 128 })
  nonce: string;

  @TlvField(104, { kind: 'u64', required: true })
  expiresAt: bigint;

  @TlvField(105, { kind: 'utf8', required: true, maxLen: 8192 })
  qrPayload: string;

  @TlvField(106, { kind: 'utf8', maxLen: 256 })
  tpsCoordinate?: string;
}

export class QrAttachKeyRequestDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  challengeUid: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 4096 })
  browserPublicKey: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 32 })
  browserKeyAlgorithm: string;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 4096 })
  browserProofSignature: string;

  @TlvField(104, { kind: 'bool' })
  trustDeviceRequested?: boolean;
}

export class QrAttachKeyResponseDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  ok: boolean;
}

export class QrApproveRequestDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  challengeUid: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 255 })
  actorId: string;

  @TlvField(102, { kind: 'utf8', required: true, maxLen: 128 })
  mobileDeviceUid: string;

  @TlvField(103, { kind: 'utf8', required: true, maxLen: 8192 })
  signedPayload: string;

  @TlvField(104, { kind: 'utf8', required: true, maxLen: 4096 })
  signature: string;

  @TlvField(105, { kind: 'arr', maxLen: 4096 })
  scope?: string[];
}

export class QrApproveResponseDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  ok: boolean;
}

export class QrRejectRequestDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  challengeUid: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 255 })
  actorId: string;
}

export class QrRejectResponseDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  ok: boolean;
}

export class QrVerifyRequestDto extends AxisTlvDto {
  @TlvField(100, { kind: 'utf8', required: true, maxLen: 128 })
  challengeUid: string;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 4096 })
  browserPublicKey: string;
}

export class QrVerifyResponseDto extends AxisTlvDto {
  @TlvField(100, { kind: 'bool', required: true })
  ok: boolean;

  @TlvField(101, { kind: 'utf8', required: true, maxLen: 32 })
  status: string;

  @TlvField(102, { kind: 'utf8', maxLen: 255 })
  actorId?: string;

  @TlvField(103, { kind: 'utf8', maxLen: 64 })
  deviceId?: string;

  @TlvField(104, { kind: 'utf8', maxLen: 128 })
  sessionUid?: string;

  @TlvField(105, { kind: 'utf8', maxLen: 128 })
  capsuleId?: string;

  @TlvField(106, { kind: 'bytes', maxLen: 512 })
  capsuleBytes?: Uint8Array;

  @TlvField(107, { kind: 'utf8', maxLen: 512 })
  intentSecret?: string;

  @TlvField(108, { kind: 'u64' })
  expiresAt?: bigint;

  @TlvField(109, { kind: 'utf8', maxLen: 256 })
  tickAuthCapsuleId?: string;

  @TlvField(110, { kind: 'utf8', maxLen: 256 })
  openLogsHash?: string;
}