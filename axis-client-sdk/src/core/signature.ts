import * as crypto from 'crypto';

import { AxisBinaryFrame, encodeFrame } from './axis-bin';

export function computeSignaturePayload(frame: AxisBinaryFrame): Buffer {
  const frameWithoutSig: AxisBinaryFrame = {
    ...frame,
    sig: new Uint8Array(0),
  };

  const encoded = encodeFrame(frameWithoutSig);
  return Buffer.from(encoded);
}

export function signFrame(frame: AxisBinaryFrame, privateKey: Buffer): Buffer {
  const payload = computeSignaturePayload(frame);

  let keyObject: crypto.KeyObject;

  if (privateKey.length === 32) {
    const pkcs8Prefix = Buffer.from([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8Key = Buffer.concat([pkcs8Prefix, privateKey]);

    keyObject = crypto.createPrivateKey({
      key: pkcs8Key,
      format: 'der',
      type: 'pkcs8',
    });
  } else {
    keyObject = crypto.createPrivateKey({
      key: privateKey,
      format: 'der',
      type: 'pkcs8',
    });
  }

  const signature = crypto.sign(null, payload, keyObject);

  if (signature.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }

  return signature;
}

export function verifyFrameSignature(
  frame: AxisBinaryFrame,
  publicKey: Buffer,
): boolean {
  if (frame.sig.length === 0) {
    return false;
  }

  if (frame.sig.length !== 64) {
    throw new Error('Ed25519 signature must be 64 bytes');
  }

  const payload = computeSignaturePayload(frame);

  try {
    let keyObject: crypto.KeyObject;

    if (publicKey.length === 32) {
      const spkiPrefix = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
      ]);
      const spkiKey = Buffer.concat([spkiPrefix, publicKey]);

      keyObject = crypto.createPublicKey({
        key: spkiKey,
        format: 'der',
        type: 'spki',
      });
    } else {
      keyObject = crypto.createPublicKey({
        key: publicKey,
        format: 'der',
        type: 'spki',
      });
    }

    return crypto.verify(null, payload, keyObject, Buffer.from(frame.sig));
  } catch {
    return false;
  }
}

export function generateEd25519KeyPair(): {
  privateKey: Buffer;
  publicKey: Buffer;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  return {
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer,
    publicKey: publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
  };
}

export function sha256(data: Buffer | Uint8Array): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

export function computeReceiptHash(
  receiptBytes: Buffer | Uint8Array,
  prevHash?: Buffer | Uint8Array,
): Buffer {
  const hasher = crypto.createHash('sha256');
  hasher.update(receiptBytes);

  if (prevHash && prevHash.length > 0) {
    hasher.update(prevHash);
  }

  return hasher.digest();
}