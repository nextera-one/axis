import * as ed from '@noble/ed25519';
import { decodeTLVs } from '../core/tlv';

export interface NodeCert {
  nodeId: string;
  kid: string;
  alg: string;
  pub: Uint8Array;
  nbf: bigint;
  exp: bigint;
  scope: string;
  issuerKid: string;
}

function td(u: Uint8Array) {
  return new TextDecoder().decode(u);
}

function u64beToBigint(b: Uint8Array): bigint {
  if (b.length !== 8) throw new Error('u64 must be 8 bytes');
  let x = 0n;
  for (const by of b) x = (x << 8n) | BigInt(by);
  return x;
}

// TLV Definitions for NodeCert Payload
const C_NODE_ID = 1;
const C_KID = 2;
const C_ALG = 3;
const C_PUB = 4;
const C_NBF = 5;
const C_EXP = 6;
const C_SCOPE = 7;
const C_ISSUER = 8;

export async function decodeAndVerifyNodeCert(
  nodeCertTLVBytes: Uint8Array,
  rootPubKey32: Uint8Array
): Promise<NodeCert> {
  const certTLV = decodeTLVs(nodeCertTLVBytes);
  const payload = certTLV.get(50); // Payload TLV
  const sig = certTLV.get(51); // Signature TLV

  if (!payload || !sig) throw new Error('NODECERT_INVALID: Missing payload or sig');
  if (sig.length !== 64) throw new Error('NODECERT_SIG_INVALID');
  if (rootPubKey32.length !== 32) throw new Error('ROOT_PUB_INVALID');

  // Verify Signature
  const ok = await ed.verify(sig, payload, rootPubKey32);
  if (!ok) throw new Error('NODECERT_NOT_TRUSTED');

  // Decode Payload
  const p = decodeTLVs(payload);
  const nodeId = td(p.get(C_NODE_ID)!);
  const kid = td(p.get(C_KID)!);
  const alg = td(p.get(C_ALG)!);
  const pub = p.get(C_PUB)!;
  const nbf = u64beToBigint(p.get(C_NBF)!);
  const exp = u64beToBigint(p.get(C_EXP)!);
  const scope = td(p.get(C_SCOPE)!);
  const issuerKid = td(p.get(C_ISSUER)!);

  if (pub.length !== 32) throw new Error('NODECERT_PUB_INVALID');
  if (alg !== 'ed25519') throw new Error('NODECERT_ALG_UNSUPPORTED');

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < nbf) throw new Error('NODECERT_NOT_YET_VALID');
  if (now > exp) throw new Error('NODECERT_EXPIRED');

  return { nodeId, kid, alg, pub, nbf, exp, scope, issuerKid };
}
