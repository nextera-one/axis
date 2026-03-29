import { describe, it, expect } from 'vitest';
import { 
  encodeVarint, decodeVarint, 
  encodeTLVs, decodeTLVs, 
  encodeFrame, decodeFrame, 
  AXIS_MAGIC, TLV_INTENT 
} from './index';

describe('Axis Core', () => {
  describe('Varint', () => {
    it('encodes and decodes small integers', () => {
      const nums = [0, 1, 127, 128, 255, 300, 16384];
      for (const n of nums) {
        const enc = encodeVarint(n);
        const dec = decodeVarint(enc);
        expect(dec.value).toBe(n);
      }
    });

    it('rejects negative numbers', () => {
      expect(() => encodeVarint(-1)).toThrow();
    });
  });

  describe('TLV', () => {
    it('encodes and decodes strictly ordered TLVs', () => {
      const input = [
        { type: 2, value: new Uint8Array([0xBB]) },
        { type: 1, value: new Uint8Array([0xAA]) }, // Unsorted input
      ];
      
      const enc = encodeTLVs(input);
      // encodeTLVs should sort them: Type 1 then Type 2
      
      const decodedMap = decodeTLVs(enc);
      expect(decodedMap.get(1)).toEqual(new Uint8Array([0xAA]));
      expect(decodedMap.get(2)).toEqual(new Uint8Array([0xBB]));
    });

    it('throws on duplicate types', () => {
      const input = [
        { type: 1, value: new Uint8Array([0xAA]) },
        { type: 1, value: new Uint8Array([0xBB]) },
      ];
      expect(() => encodeTLVs(input)).toThrow(/Duplicate TLV/);
    });
  });

  describe('Frame', () => {
    it('encodes and decodes a full frame', () => {
      const frame = {
        flags: 0x01,
        headers: new Map([
          [TLV_INTENT, new TextEncoder().encode('test.intent')]
        ]),
        body: new Uint8Array([1, 2, 3]),
        sig: new Uint8Array([0xFF, 0xEE]),
      };

      const buf = encodeFrame(frame);
      expect(buf).toBeInstanceOf(Uint8Array);
      
      // Check Magic
      expect(buf.slice(0, 5)).toEqual(AXIS_MAGIC);

      const decoded = decodeFrame(buf);
      expect(decoded.flags).toBe(0x01);
      expect(decoded.headers.get(TLV_INTENT)).toEqual(frame.headers.get(TLV_INTENT));
      expect(decoded.body).toEqual(frame.body);
      expect(decoded.sig).toEqual(frame.sig);
    });
  });
});
