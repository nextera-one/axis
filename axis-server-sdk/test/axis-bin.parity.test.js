const test = require('node:test');
const assert = require('node:assert/strict');

const protocol = require('@nextera.one/axis-protocol');
const serverCore = require('../dist/core/index.js');
const { encodeAxis1Frame } = require('../dist/codec/axis1.encode.js');
const { axis1SigningBytes } = require('../dist/codec/axis1.signing.js');
const { decodeAxis1Frame } = require('../dist/types/frame.js');

function makeFrame() {
  return {
    flags: 1,
    headers: new Map([
      [1, Uint8Array.from([1, 2, 3])],
      [3, new TextEncoder().encode('system.echo')],
      [10, Uint8Array.from([9, 8, 7, 6])],
    ]),
    body: Uint8Array.from([10, 20, 30, 40]),
    sig: Uint8Array.from([50, 60, 70]),
  };
}

function makeAxis1Shape() {
  const frame = makeFrame();
  const hdr = Buffer.from(
    protocol.encodeTLVs(
      Array.from(frame.headers.entries()).map(([type, value]) => ({
        type,
        value,
      })),
    ),
  );

  return {
    ver: protocol.AXIS_VERSION,
    flags: frame.flags,
    hdr,
    body: Buffer.from(frame.body),
    sig: Buffer.from(frame.sig),
  };
}

test('server axis-bin codec matches protocol package behavior', () => {
  const frame = makeFrame();

  const protocolEncoded = protocol.encodeFrame(frame);
  const serverEncoded = serverCore.encodeFrame(frame);
  assert.deepStrictEqual(serverEncoded, protocolEncoded);

  const protocolDecoded = protocol.decodeFrame(protocolEncoded);
  const serverDecoded = serverCore.decodeFrame(serverEncoded);
  assert.deepStrictEqual(serverDecoded, protocolDecoded);

  const protocolSignTarget = protocol.getSignTarget(frame);
  const serverSignTarget = serverCore.getSignTarget(frame);
  assert.deepStrictEqual(serverSignTarget, protocolSignTarget);
  assert.deepStrictEqual(
    serverCore.computeSignaturePayload(frame),
    Buffer.from(protocolSignTarget),
  );
});

test('AxisFrameZ accepts protocol-decoded frames', () => {
  const decoded = protocol.decodeFrame(protocol.encodeFrame(makeFrame()));
  const parsed = serverCore.AxisFrameZ.parse(decoded);

  assert.deepStrictEqual(parsed, decoded);
});

test('AxisFrameZ rejects invalid frame shape', () => {
  const invalidFrame = {
    ...makeFrame(),
    body: 'invalid',
  };

  assert.throws(() => serverCore.AxisFrameZ.parse(invalidFrame));
});

test('Axis1 encoder matches protocol binary frame for canonical headers', () => {
  const axis1 = makeAxis1Shape();
  const protocolFrame = {
    flags: axis1.flags,
    headers: protocol.decodeTLVs(axis1.hdr),
    body: axis1.body,
    sig: axis1.sig,
  };

  const protocolEncoded = Buffer.from(protocol.encodeFrame(protocolFrame));
  const serverEncoded = encodeAxis1Frame(axis1);

  assert.deepStrictEqual(serverEncoded, protocolEncoded);
});

test('Axis1 decoder preserves raw payload slices from protocol frames', () => {
  const axis1 = makeAxis1Shape();
  const encoded = encodeAxis1Frame(axis1);
  const decoded = decodeAxis1Frame(encoded);

  assert.deepStrictEqual(decoded, {
    ver: axis1.ver,
    flags: axis1.flags,
    hdr: axis1.hdr,
    body: axis1.body,
    sig: axis1.sig,
    frameSize: encoded.length,
  });
});

test('Axis1 signing bytes match protocol sign-target for canonical headers', () => {
  const axis1 = makeAxis1Shape();
  const protocolFrame = {
    flags: axis1.flags,
    headers: protocol.decodeTLVs(axis1.hdr),
    body: axis1.body,
    sig: axis1.sig,
  };

  const protocolSignTarget = Buffer.from(protocol.getSignTarget(protocolFrame));
  const serverSignTarget = axis1SigningBytes({
    ver: axis1.ver,
    flags: axis1.flags,
    hdr: axis1.hdr,
    body: axis1.body,
  });

  assert.deepStrictEqual(serverSignTarget, protocolSignTarget);
});