// axis1.encode.ts
import { encVarint } from './tlv.encode';

const MAGIC = Buffer.from('AXIS1', 'ascii');

export type Axis1FrameToEncode = {
  ver: number; // 1
  flags: number; // bit flags
  hdr: Buffer; // TLVs
  body: Buffer; // TLVs or raw payload
  sig: Buffer; // signature bytes
};

export function encodeAxis1Frame(f: Axis1FrameToEncode): Buffer {
  if (
    !Buffer.isBuffer(f.hdr) ||
    !Buffer.isBuffer(f.body) ||
    !Buffer.isBuffer(f.sig)
  ) {
    throw new Error('AXIS1_BAD_BUFFERS');
  }
  if (f.ver !== 1) throw new Error('AXIS1_BAD_VER');

  const hdrLen = encVarint(BigInt(f.hdr.length));
  const bodyLen = encVarint(BigInt(f.body.length));
  const sigLen = encVarint(BigInt(f.sig.length));

  return Buffer.concat([
    MAGIC,
    Buffer.from([f.ver & 0xff]),
    Buffer.from([f.flags & 0xff]),
    hdrLen,
    bodyLen,
    sigLen,
    f.hdr,
    f.body,
    f.sig,
  ]);
}
