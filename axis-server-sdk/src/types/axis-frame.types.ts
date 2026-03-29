import {
  AxisAlg as CryptoAxisAlg,
  AxisSig as CryptoAxisSig,
  AxisResponse as CryptoAxisResponse,
} from '../crypto/types';

/**
 * ✅ AXIS Frame Types (Protocol v1)
 * Core type system for AXIS frames, packets, and execution context.
 * These types enforce the cryptographic proof model.
 */

// Crypto layer allows multiple algs; frame validation restricts to EdDSA only.
export type AxisAlg = Extract<CryptoAxisAlg, 'EdDSA'>;

// Reuse crypto envelope but narrow alg to EdDSA for frames.
export type AxisSig = CryptoAxisSig & { alg: AxisAlg };

export interface AxisFrame<T = any> {
  v: 1;
  pid: string; // packet/trace ID (ULID)
  nonce: string; // anti-replay nonce
  ts: number; // unix timestamp (seconds)
  actorId: string; // claimed sender (actor:user_* or svc:*)
  aud?: string; // intended receiver (service binding)
  opcode: string; // operation selector
  headers: Map<number, Uint8Array>;
  body: T; // operation payload
  sig: AxisSig; // signature over canonical JSON of unsigned frame
}

export type AxisResponse<T = any> = CryptoAxisResponse<T> & {
  policyRefs?: string[];
  riskScore?: number;
};

export interface AxisObservedContext {
  ip?: string;
  ua?: string;
  geo?: string; // ISO country code from server-derived IP lookup
}

export interface AxisRequestContext {
  observed: AxisObservedContext;
  actorKeyKid?: string;
  issuerKeyKid?: string;
  decisionId: string;
  actorId: string;
  aud?: string;
  opcode: string;
  deviceId?: string; // server-verified device binding (not from client hints)
  sessionId?: string; // server-verified session binding
}
