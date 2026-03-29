# @nextera.one/axis-client-sdk

Official TypeScript/JavaScript client SDK for the **AXIS Protocol v1**.

[![npm version](https://img.shields.io/npm/v/@nextera.one/axis-client-sdk.svg)](https://www.npmjs.com/package/@nextera.one/axis-client-sdk)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org)

## Features

- 🔐 **Ed25519 Signing** - Cryptographic signatures for frame integrity
- 📦 **Binary Protocol** - Efficient TLV (Type-Length-Value) encoding
- 🎯 **Intent-Based** - Route requests through configurable sensor pipeline
- 🔄 **Retry Logic** - Automatic retry with exponential backoff
- 📤 **File Upload** - Chunked upload with resume support
- 🎭 **Multiple Proof Types** - Capsule, JWT, mTLS, Loom, Witness signatures
- ⚡ **Zero Dependencies** - Minimal external dependencies (only @noble/ed25519, axios)

## Installation

```bash
npm install @nextera.one/axis-client-sdk
# or
yarn add @nextera.one/axis-client-sdk
# or
pnpm add @nextera.one/axis-client-sdk
```

## Quick Start

### Basic Usage (JSON)

```typescript
import { AxisClient } from '@nextera.one/axis-client-sdk';

const client = new AxisClient({
  baseUrl: 'http://localhost:3000/api/axis',
  actorId: 'your-actor-uuid',
});

const result = await client.send('public.ping', { message: 'Hello' });
console.log(result.data);
```

### Binary Protocol with Signing

```typescript
import { AxisClient, Ed25519Signer } from '@nextera.one/axis-client-sdk';

// Create signer from private key
const privateKey = Buffer.from('your-32-byte-private-key');
const signer = new Ed25519Signer(privateKey);

const client = new AxisClient({
  baseUrl: 'http://localhost:3000/api/axis',
  actorId: 'your-actor-uuid',
  useBinary: true,
  signer, // Frames will be automatically signed
});

const result = await client.send('schema.validate', {
  data: {
    /* your data */
  },
});
```

### Frame Builder (Manual Frame Construction)

```typescript
import {
  AxisFrameBuilder,
  generatePid,
  generateNonce,
  uuidToBytes,
  ProofType,
} from '@nextera.one/axis-client-sdk';

const builder = new AxisFrameBuilder()
  .setPid(generatePid())
  .setTimestamp(BigInt(Date.now()))
  .setIntent('public.ping')
  .setActorId(uuidToBytes('your-actor-uuid'))
  .setProofType(ProofType.CAPSULE)
  .setProofRef(Buffer.alloc(16)) // Capsule ID or empty
  .setNonce(generateNonce())
  .setBodyJSON({ message: 'Hello' });

// Build unsigned frame
const unsignedFrame = builder.buildUnsigned();

// Sign and build signed frame
const signature = await signer.sign(unsignedFrame);
const signedFrame = builder.buildSigned(signature);
```

### File Upload with Progress

```typescript
const result = await client.uploadFile('./large-file.dat', {
  chunkSize: 1024 * 1024, // 1MB chunks
  onProgress: (progress) => {
    console.log(`Uploading: ${progress.percent}%`);
  },
});

console.log(`File uploaded: ${result.fileId}`);
```

### File Download

```typescript
await client.downloadFile('file-id', './downloaded-file.dat', {
  onProgress: (progress) => {
    console.log(`Downloaded: ${progress.percent}%`);
  },
});
```

## API Reference

### AxisClient

Main client for communicating with AXIS servers.

#### Constructor

```typescript
new AxisClient(config: AxisClientConfig)
```

**Config Options:**

- `baseUrl` (required) - Server endpoint URL
- `actorId` (required) - UUID of actor/user
- `capsuleId?` - UUID of capsule for proof
- `signer?` - Ed25519Signer instance for frame signing
- `maxRetries?` - Max retry attempts (default: 3)
- `retryDelayMs?` - Delay between retries (default: 1000)
- `timeout?` - Request timeout in ms (default: 30000)
- `useBinary?` - Use binary protocol (default: false)

#### Methods

**send(intent, body?): Promise<IntentResult>**

- Send an intent with automatic retry
- Returns `{ ok: boolean, data?: any, error?: string }`

**uploadFile(path, options?): Promise<UploadResult>**

- Upload file with chunking and resume
- Options: `chunkSize`, `resumeFileId`, `onProgress`

**downloadFile(fileId, destPath, options?): Promise<void>**

- Download file with range requests
- Options: `onProgress`

**streamTail(topic, callback, options?): Promise<() => void>**

- Subscribe to event stream
- Returns unsubscribe function

### Frame Builder

Low-level frame construction.

```typescript
const builder = new AxisFrameBuilder();

builder
  .setPid(pid) // 16-byte packet ID
  .setTimestamp(ts) // Timestamp (bigint)
  .setIntent(intent) // Intent name
  .setActorId(actorId) // 16-byte actor UUID
  .setProofType(type) // Proof type enum
  .setProofRef(ref) // Proof reference
  .setNonce(nonce) // 16-32 byte nonce
  .setRealm(realm) // (Optional) Realm string
  .setNode(node) // (Optional) Node string
  .setTraceId(traceId) // (Optional) Trace ID
  .setBody(body) // Binary body
  .setBodyJSON(obj) // JSON body
  .setFlags(bodyt, chain, witness);

// Get unsigned frame for signing
const unsigned = builder.buildUnsigned();

// Build signed frame
const signed = builder.buildSigned(signature);
```

### Ed25519Signer

Sign frames with Ed25519 signatures.

```typescript
import { Ed25519Signer } from '@nextera.one/axis-client-sdk';

const signer = new Ed25519Signer(privateKey); // 32-byte seed

const signature = await signer.sign(message);
const publicKey = await signer.getPublicKey();
```

### Binary Utilities

```typescript
import {
  generatePid, // Generate random 16-byte PID
  generateNonce, // Generate random 16-32 byte nonce
  uuidToBytes, // Convert UUID string to bytes
  bytesToUuid, // Convert bytes to UUID string
} from '@nextera.one/axis-client-sdk';

const pid = generatePid();
const nonce = generateNonce(32);
const bytes = uuidToBytes('550e8400-e29b-41d4-a716-446655440000');
const uuid = bytesToUuid(bytes);
```

### Frame Encoding/Decoding

```typescript
import {
  AxisBinaryFrame,
  TLV_AUD,
  TLV_REALM,
  encodeFrame,
  decodeFrame,
  getSignTarget,
  signFrame,
  verifyFrameSignature,
} from '@nextera.one/axis-client-sdk/core';

// Encode frame to binary
const buffer = encodeFrame(frame);

// Decode binary to frame
const frame = decodeFrame(buffer);
```

## Shared Core API

The `./core` subpath is intentionally aligned with the server SDK for shared protocol work.

- `AxisBinaryFrame` is the low-level binary frame type.
- `TLV_AUD` is the canonical name for tag `8`.
- `TLV_REALM` remains available as a compatibility alias.
- The client core exports the same protocol constants as the server core, including Loom, witness, body-profile, upload, and node-certificate constants.
- Prefer `./core` for code meant to run against both client and server SDKs.

## Frame Format

The AXIS Protocol v1 binary frame format:

```
[MAGIC(5)][VERSION(1)][FLAGS(1)][HDR_LEN(V)][BODY_LEN(V)]
[HEADERS][BODY][SIG_LEN(V)][SIGNATURE(64)]

MAGIC:     AXIS1 (0x41 0x58 0x49 0x53 0x31) - 5 bytes
VERSION:   0x01 - 1 byte
FLAGS:     Bitfield - 1 byte
           Bit 0: Body is TLV encoded
           Bit 1: Receipt chaining requested
           Bit 2: Witness included
HDR_LEN:   Varint (LEB128) - variable length
BODY_LEN:  Varint (LEB128) - variable length
HEADERS:   TLV-encoded header fields
BODY:      Raw or TLV-encoded body (up to 64KB)
SIG_LEN:   Varint (LEB128) - signature length
SIGNATURE: 64-byte Ed25519 signature (optional)
```

## Header Fields (TLV)

Required headers:

- **PID (1)** - 16-byte packet ID (UUIDv7)
- **TS (2)** - 8-byte timestamp
- **INTENT (3)** - UTF-8 intent name
- **ACTOR_ID (4)** - 16-byte actor UUID
- **PROOF_TYPE (5)** - 1-byte proof type
- **PROOF_REF (6)** - 1-64 byte proof reference
- **NONCE (7)** - 16-32 byte anti-replay nonce

Optional headers:

- **REALM (8)** - Routing hint
- **NODE (9)** - Node selector
- **TRACE_ID (10)** - Trace correlation
- **WITNESS_REF (11)** - Witness identifier
- **CONTRACT_ID (12)** - Execution contract
- **EXPECTED_EFFECT (13)** - Declared effect

## Protocol Constants

```typescript
// Hard limits (enforced)
MAX_FRAME_LEN = 71,680      // 70 KB
MAX_HDR_LEN = 2,048         // 2 KB
MAX_BODY_LEN = 65,536       // 64 KB
MAX_SIG_LEN = 128           // 128 bytes
MAX_TLVS = 64               // Max header TLVs

// Varint limits
MAX_VARINT_BYTES = 5        // LEB128 encoding
```

## Error Handling

```typescript
const result = await client.send('public.ping', {});

if (!result.ok) {
  console.error(`Error: ${result.error}`);

  // Common error codes from server
  // - INVALID_PACKET
  // - BAD_SIGNATURE
  // - REPLAY_DETECTED
  // - RATE_LIMITED
  // - INTENT_NOT_FOUND
  // - INTERNAL_ERROR
}
```

## Development

### Build

```bash
npm run build
```

Outputs:

- `dist/index.js` - CommonJS
- `dist/index.mjs` - ESM
- `dist/index.d.ts` - TypeScript definitions

### Testing

```bash
npm test
```

## Environment Support

- **Node.js** 18.0.0+
- **Browsers** with proper crypto support (via polyfills)
- **Deno** 1.40+

## Security

- Frames are signed with Ed25519 before transmission
- Signatures verify integrity of entire frame
- Support for public key rotation via KID (Key ID)
- Nonce prevents replay attacks
- No sensitive data in logs

## License

Apache License 2.0 - See [LICENSE](LICENSE) file

## Contributing

Contributions welcome! Please submit PRs with:

- Unit tests
- TypeScript strict mode compliance
- Documentation updates

## Support

- 📖 [Documentation](https://github.com/your-org/axis/docs)
- 🐛 [Issues](https://github.com/your-org/axis/issues)
- 💬 [Discussions](https://github.com/your-org/axis/discussions)

---

**AXIS Protocol** - Auditable, Secure, Intent-based eXchange
