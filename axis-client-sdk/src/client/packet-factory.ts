import { v7 as uuidv7 } from 'uuid';
import { AxisFrame, encodeFrame, getSignTarget } from '../core/axis-bin';
import { buildIntentReference } from '../core/intent-reference';
import { Signer } from '../signer';
import {
  FLAG_BODY_TLV,
  TLV_ACTOR_ID,
  TLV_INTENT,
  TLV_NONCE,
  TLV_PID,
  TLV_PROOF_REF,
  TLV_PROOF_TYPE,
  TLV_TS,
} from '../core/constants';
import { encodeVarint } from '../core/varint';

export interface PacketOptions {
  intent: string;
  handlerName?: string;
  body: Uint8Array; // Already encoded body (or raw)
  actorId: string; // Hex string (16 bytes)
  proofType: number;
  proofRef?: Uint8Array;
}

export class PacketFactory {
  constructor(private readonly signer: Signer) {}

  async createFrame(opts: PacketOptions): Promise<AxisFrame> {
    const pid = uuidv7ToBytes(uuidv7());
    const ts = BigInt(Date.now()); // Using milli-timestamp for v1 simplicity
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const actorId = hexToBytes(opts.actorId);

    const headers = new Map<number, Uint8Array>();
    headers.set(TLV_PID, pid);
    headers.set(TLV_TS, encodeVarint(Number(ts))); // Careful with big ints in varint v1
    headers.set(
      TLV_INTENT,
      new TextEncoder().encode(
        buildIntentReference(opts.intent, opts.handlerName),
      ),
    );
    headers.set(TLV_ACTOR_ID, actorId);
    headers.set(TLV_PROOF_TYPE, encodeVarint(opts.proofType));
    headers.set(TLV_NONCE, nonce);

    if (opts.proofRef) {
      headers.set(TLV_PROOF_REF, opts.proofRef);
    }

    const partialFrame: AxisFrame = {
      flags: FLAG_BODY_TLV,
      headers,
      body: opts.body,
      sig: new Uint8Array(0),
    };

    const toSign = getSignTarget(partialFrame);
    const sig = await this.signer.sign(toSign);

    return { ...partialFrame, sig };
  }
}

function uuidv7ToBytes(uuid: string): Uint8Array {
  // Simple hex parse for now. UUID lib might offer bytes directly.
  return hexToBytes(uuid.replace(/-/g, ''));
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex');
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    buf[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return buf;
}
