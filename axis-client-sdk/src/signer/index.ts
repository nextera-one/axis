import * as ed from '@noble/ed25519';

export interface Signer {
  sign(message: Uint8Array): Promise<Uint8Array>;
  getPublicKey(): Promise<Uint8Array>;
  getAlg(): string;
}

export class Ed25519Signer implements Signer {
  constructor(private readonly privateKey: Uint8Array) {
    if (privateKey.length !== 32) throw new Error('Private key must be 32 bytes');
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    return ed.signAsync(message, this.privateKey);
  }

  async getPublicKey(): Promise<Uint8Array> {
    return ed.getPublicKeyAsync(this.privateKey);
  }

  getAlg(): string {
    return 'ed25519';
  }
}
