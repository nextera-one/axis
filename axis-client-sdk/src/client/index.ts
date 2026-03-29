import { TrustStore } from '../trust/trust-store';
import { TLV_EFFECT, TLV_ERROR_CODE, TLV_NODE_CERT_HASH, TLV_NODE_KID } from '../core/constants';
import { PacketFactory } from './packet-factory';
import { AxisTransport } from '../transport';
import { Signer } from '../signer';

export interface AxisBinaryClientOptions {
  signer: Signer;
  transport: AxisTransport;
  actorId: string; // Hex
  trustStore?: TrustStore;
}

/**
 * Binary-transport AXIS client (low-level).
 * For the high-level HTTP client, use AxisClient from './axis-client'.
 */
export class AxisBinaryClient {
  private readonly factory: PacketFactory;
  private readonly transport: AxisTransport;
  private readonly trustStore?: TrustStore;
  private readonly actorId: string;

  constructor(opts: AxisBinaryClientOptions) {
    this.factory = new PacketFactory(opts.signer);
    this.transport = opts.transport;
    this.trustStore = opts.trustStore;
    this.actorId = opts.actorId;
  }

  async send(intent: string, bodyTLV: Uint8Array): Promise<any> {
    const frame = await this.factory.createFrame({
      intent,
      body: bodyTLV,
      actorId: this.actorId,
      proofType: 1, // Capsule by default in v1
      // proofRef: ... (need to manage capsules)
    });

    const receiptFrame = await this.transport.send(frame);

    // Verify Receipt
    // 1. Get Node KID
    // 2. Lookup Key in TrustStore
    // 3. Verify Signature
    // For now, allow bypass if no trustStore
    if (this.trustStore) {
      // TODO: Full receipt verification
    }

    // Parse Result (Effect vs Error)
    const errCode = receiptFrame.headers.get(TLV_ERROR_CODE);
    if (errCode) {
      throw new Error(`Axis Error: ${new TextDecoder().decode(errCode)}`);
    }

    const effect = receiptFrame.headers.get(TLV_EFFECT);
    return {
      ok: true,
      effect: effect ? new TextDecoder().decode(effect) : 'unknown',
      body: receiptFrame.body,
    };
  }
}
