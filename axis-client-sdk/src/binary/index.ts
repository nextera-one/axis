/**
 * AXIS Client SDK - Binary Support Exports
 */

// Varint
export { encodeVarint, decodeVarint } from './varint';

// TLV
export { encodeTLVs, decodeTLVs, encodeTLV, TLV } from './tlv';

// Frame builder
export { 
  AxisFrameBuilder, 
  AxisFrameInput,
  generatePid,
  generateNonce,
  uuidToBytes,
  bytesToUuid 
} from './frame-builder';

// Types
export {
  TLVType,
  ProofType,
  FrameFlags,
  ReceiptTLVType,
  ErrorCode,
  DecodedFrame,
} from './binary-types';
