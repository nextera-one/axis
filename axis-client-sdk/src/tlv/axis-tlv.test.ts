/**
 * AXIS TLV Tests
 * Tests for varint-based TLV encoding/decoding and REST bridge.
 */

import { describe, it, expect } from 'vitest';
import {
  encodeTLVs,
  decodeTLVs,
  pack,
  unpack,
  getOne,
  tlvString,
  tlvU8,
  tlvU16,
  tlvU32,
  tlvU64,
  tlvBytes,
  readString,
  readU8,
  readU16,
  readU32,
  readU64,
  AXIS_TAG,
  AxisRestBridge,
  signTlvFrame,
  verifyTlvFrameSignature,
} from './index';
import { Ed25519Signer } from '../signer';

describe('AXIS TLV (varint)', () => {
  describe('encodeTLVs / decodeTLVs', () => {
    it('encodes and decodes empty array', () => {
      const encoded = encodeTLVs([]);
      expect(encoded.length).toBe(0);

      const decoded = decodeTLVs(encoded);
      expect(decoded.size).toBe(0);
    });

    it('encodes and decodes single TLV', () => {
      const tlv = { type: 1, value: new Uint8Array([0xaa, 0xbb]) };
      const encoded = encodeTLVs([tlv]);

      // varint type 1 = 1 byte, varint len 2 = 1 byte, value = 2 bytes = 4 bytes
      expect(encoded.length).toBe(4);

      const decoded = decodeTLVs(encoded);
      expect(decoded.size).toBe(1);
      expect(decoded.get(1)).toEqual(new Uint8Array([0xaa, 0xbb]));
    });

    it('encodes and decodes multiple TLVs (canonical sorting)', () => {
      const tlvs = [
        { type: 10, value: new Uint8Array([0x03]) }, // Will be sorted last
        { type: 1, value: new Uint8Array([0x01]) }, // Will be sorted first
        { type: 3, value: new Uint8Array([0x02]) }, // Will be sorted middle
      ];

      const encoded = encodeTLVs(tlvs);
      const decoded = decodeTLVs(encoded);

      expect(decoded.size).toBe(3);
      expect(decoded.get(1)?.[0]).toBe(0x01);
      expect(decoded.get(3)?.[0]).toBe(0x02);
      expect(decoded.get(10)?.[0]).toBe(0x03);
    });

    it('rejects duplicate types', () => {
      const tlvs = [
        { type: 1, value: new Uint8Array([0x01]) },
        { type: 1, value: new Uint8Array([0x02]) },
      ];

      expect(() => encodeTLVs(tlvs)).toThrow(/Duplicate/);
    });

    it('handles string values', () => {
      const str = 'hello world';
      const tlv = tlvString(AXIS_TAG.INTENT, str);
      const encoded = encodeTLVs([tlv]);
      const decoded = decodeTLVs(encoded);

      expect(readString(decoded.get(AXIS_TAG.INTENT))).toBe(str);
    });

    it('handles numeric values', () => {
      const tlvs = [
        tlvU8(1, 255),
        tlvU16(2, 0x1234),
        tlvU32(3, 0x12345678),
        tlvU64(4, 0x123456789abcdef0n),
      ];

      const encoded = encodeTLVs(tlvs);
      const decoded = decodeTLVs(encoded);

      expect(readU8(decoded.get(1))).toBe(255);
      expect(readU16(decoded.get(2))).toBe(0x1234);
      expect(readU32(decoded.get(3))).toBe(0x12345678);
      expect(readU64(decoded.get(4))).toBe(0x123456789abcdef0n);
    });
  });

  describe('pack / unpack (nested TLVs)', () => {
    it('packs and unpacks nested TLVs', () => {
      const inner = [
        tlvString(AXIS_TAG.HTTP_METHOD, 'POST'),
        tlvString(AXIS_TAG.HTTP_PATH, '/v1/users'),
      ];

      const packed = pack(AXIS_TAG.PROOF_PACK, inner);
      expect(packed.type).toBe(AXIS_TAG.PROOF_PACK);

      const unpacked = unpack(packed.value);
      expect(unpacked.size).toBe(2);
      expect(readString(getOne(unpacked, AXIS_TAG.HTTP_METHOD))).toBe('POST');
      expect(readString(getOne(unpacked, AXIS_TAG.HTTP_PATH))).toBe('/v1/users');
    });
  });

  describe('AxisRestBridge', () => {
    it('creates backend-compatible header TLVs', () => {
      const headers = AxisRestBridge.restToAxisHeaders(
        { method: 'GET', url: '/v1/users' },
        { actorId: 'a'.repeat(32) }
      );

      // Should have PID, TS, INTENT, ACTOR_ID, PROOF_TYPE, NONCE
      const types = headers.map((h) => h.type);
      expect(types).toContain(AXIS_TAG.PID);
      expect(types).toContain(AXIS_TAG.TS);
      expect(types).toContain(AXIS_TAG.INTENT);
      expect(types).toContain(AXIS_TAG.ACTOR_ID);
      expect(types).toContain(AXIS_TAG.PROOF_TYPE);
      expect(types).toContain(AXIS_TAG.NONCE);

      // Check intent is inferred correctly
      const intentTlv = headers.find((h) => h.type === AXIS_TAG.INTENT);
      expect(readString(intentTlv?.value)).toBe('rest.get.v1.users');
    });

    it('encodes headers to bytes', () => {
      const headers = AxisRestBridge.restToAxisHeaders(
        { method: 'POST', url: '/test' },
        { actorId: '0'.repeat(32) }
      );

      const encoded = AxisRestBridge.encodeHeaders(headers);
      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBeGreaterThan(0);

      // Should be decodable
      const decoded = decodeTLVs(encoded);
      expect(decoded.size).toBeGreaterThan(0);
    });
  });

  describe('Frame Signing', () => {
    it('signs and verifies frame with Ed25519', async () => {
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      const signer = new Ed25519Signer(privateKey);

      const headers = AxisRestBridge.restToAxisHeaders(
        { method: 'GET', url: '/test' },
        { actorId: '0'.repeat(32) }
      );

      const headerBytes = AxisRestBridge.encodeHeaders(headers);
      const bodyBytes = new Uint8Array([1, 2, 3]);

      // Sign
      const signature = await signTlvFrame(headerBytes, bodyBytes, signer);
      expect(signature.length).toBe(64); // Ed25519 signature

      // Verify
      const pubKey = await signer.getPublicKey();
      const verified = await verifyTlvFrameSignature(
        headerBytes,
        bodyBytes,
        signature,
        pubKey
      );
      expect(verified).toBe(true);
    });

    it('fails verification on tampered data', async () => {
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      const signer = new Ed25519Signer(privateKey);

      const headers = AxisRestBridge.restToAxisHeaders(
        { method: 'POST', url: '/secure' },
        { actorId: '0'.repeat(32) }
      );

      const headerBytes = AxisRestBridge.encodeHeaders(headers);
      const bodyBytes = new Uint8Array([1, 2, 3]);

      const signature = await signTlvFrame(headerBytes, bodyBytes, signer);

      // Tamper with body
      const tamperedBody = new Uint8Array([1, 2, 4]);

      const pubKey = await signer.getPublicKey();
      const verified = await verifyTlvFrameSignature(
        headerBytes,
        tamperedBody,
        signature,
        pubKey
      );
      expect(verified).toBe(false);
    });
  });
});
