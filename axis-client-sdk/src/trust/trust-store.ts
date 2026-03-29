import { decodeAndVerifyNodeCert, NodeCert } from './nodecert';

export class TrustStore {
  // rootKid -> rootPub
  private roots = new Map<string, Uint8Array>();
  // nodeKid -> nodePub
  private nodes = new Map<string, Uint8Array>();
  // revoked node kids
  private revoked = new Set<string>();

  constructor() {}

  addRoot(kid: string, pubKey: Uint8Array) {
    if (pubKey.length !== 32) throw new Error('Invalid root key length');
    this.roots.set(kid, pubKey);
  }

  getRoot(kid: string): Uint8Array | undefined {
    return this.roots.get(kid);
  }

  isRevoked(kid: string) {
    return this.revoked.has(kid);
  }

  getNodePub(kid: string) {
    return this.nodes.get(kid);
  }

  async verifyAndPinNodeCert(certBytes: Uint8Array): Promise<NodeCert> {
    // We need to parse enough to find the issuer KID first?
    // Actually decodeAndVerifyNodeCert needs us to provide the root key.
    // So we try all roots? Or we assume the cert payload has issuer KID.
    // The current decoder validates signature inside.
    // Let's rely on the decoder for now, but we need the root key.
    
    // For v1, we iterate roots (usually just 1-2).
    for (const [rootKid, rootPub] of this.roots) {
        try {
            const cert = await decodeAndVerifyNodeCert(certBytes, rootPub);
            if (this.isRevoked(cert.kid)) throw new Error('Node Revoked');
            
            // Success - Pin it
            this.nodes.set(cert.kid, cert.pub);
            return cert;
        } catch (e) {
            // Try next root
        }
    }
    throw new Error('NodeCert verification failed against all pinned roots');
  }
}
