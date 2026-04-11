// axis1.signing.ts
import { AXIS_MAGIC, AXIS_VERSION } from '@nextera.one/axis-protocol';

import { encVarint } from './tlv.encode';

const MAGIC = Buffer.from(AXIS_MAGIC);

export function axis1SigningBytes(params: {
  ver: number;
  flags: number;
  hdr: Buffer;
  body: Buffer;
}): Buffer {
  if (params.ver !== AXIS_VERSION) throw new Error('AXIS1_BAD_VER');
  const hdrLen = encVarint(BigInt(params.hdr.length));
  const bodyLen = encVarint(BigInt(params.body.length));
  const sigLenZero = encVarint(0n); // IMPORTANT: sigLen=0 in signing bytes

  return Buffer.concat([
    MAGIC,
    Buffer.from([params.ver & 0xff]),
    Buffer.from([params.flags & 0xff]),
    hdrLen,
    bodyLen,
    sigLenZero,
    params.hdr,
    params.body,
  ]);
}
