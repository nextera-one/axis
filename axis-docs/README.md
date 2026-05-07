# AXIS Protocol Documentation

Welcome to the official documentation for the AXIS Protocol. AXIS is a high-assurance, message-passing protocol designed for critical digital infrastructure, providing a unified security model for both binary and JSON communications.

---

## 1. Project Map
This overview outlines the repository structure and the purpose of each component.

### 1.1 Core Components
- **[axis-backend](../axis-backend)**: The reference implementation of the AXIS protocol engine (NestJS).
  - `src/engine`: Execution pipeline, routing, and the sensor chain (`src/engine/sensors`).
  - `src/security`: Protocol enforcement, opcode routing, and middleware.
  - `src/crypto`: Key management, signing, verification, and capsule issuance.
  - `src/axis`: Database entities and CRUD services for all AXIS tables.
- **[axis-client-sdk](../axis-client-sdk)**: TypeScript/JavaScript SDK for building AXIS-compliant clients.
  - `src/client`: `AxisClient` (HTTP transport) and `TypedAxisClient` (type-safe intent wrappers).
  - `src/core`: Frame building, capsule management, and signing logic.
  - `src/binary`: Binary encoding constants (TLV tags, proof types, frame flags).
  - `src/tlv`: TLV codec, REST bridge, and proxy client.
  - `src/signer`: Ed25519 signing implementation.
  - `src/nestflow`: Passwordless QR login, device identity, TickAuth, and session helpers.
- **[axis-server-sdk](../axis-server-sdk)**: Server-side SDK with decorators, routing, guards, and protocol primitives.
  - `src/core`: Binary frame codec, TLV, varint, signatures, opcodes, receipts, and intent sensitivity.
  - `src/decorators`: `@Handler` and `@Intent` decorators for NestJS integration.
  - `src/engine`: `IntentRouter` dispatcher.
  - `src/security`: Scope validation (BOLA prevention) and capability model.
  - `src/sensor`: Sensor interface and decision types.
  - `src/codec`: ATS1 codec, AXIS v1 encoding, and TLV encoding.
  - `src/nestflow`: Server-side guards, policy map, state machine invariants.
- **[axis-cli](../axis-cli)**: Command-line tool for interacting with AXIS nodes.
  - Commands: `send`, `file`, `stream`, `issue-node-cert`, `device`, `session`, `identity`.

### 1.2 Documentation and Specifications
- **[axis-docs](../axis-docs)**: Official protocol and developer documentation.
- **[axis-spec-tests](../axis-spec-tests)**: Language-agnostic test suite for protocol compliance.

### 1.3 Frontend and Infrastructure
- **[axis-frontend](../axis-frontend)**: Reference administrative dashboard for AXIS nodes.
- **[axis-protocol-website](../axis-protocol-website)**: Public-facing website for the AXIS protocol.
- **[axis-proxy](../axis-proxy)**: High-performance edge proxy for AXIS traffic.
- **[database](../database)**: Database migration scripts and schema definitions.

---

## 2. Protocol Specification (v1.1)

### 2.1 Core Philosophy
- **No-REST-Fallback**: All operations must flow through the AXIS ingress. Standard REST patterns are discouraged.
- **Security-First**: Every request is signed and validated by a multi-layered sensor chain before execution.
- **Transport Agnostic**: While typically carried over HTTP, AXIS frames can be sent over TCP, WebSockets, or even serial links.

### 2.2 AXIS-BIN (Binary Frame)
The binary format is optimized for performance and compact representation.

| Component | Size | Description |
| :--- | :--- | :--- |
| **Magic** | 5 bytes | `AXIS1` (ASCII `0x41 0x58 0x49 0x53 0x31`) |
| **Version** | 1 byte | `0x01` |
| **Flags** | 1 byte | Bitmask (e.g., `0x01` for compressed body) |
| **Header Len** | Varint | Length of the TLV Header block |
| **Body Len** | Varint | Length of the Body block |
| **Sig Len** | Varint | Length of the Signature block |
| **Headers** | Variable | Sequence of TLV entries |
| **Body** | Variable | Payload (JSON or raw bytes) |
| **Signature** | Variable | Ed25519 signature of the frame |

#### Standard TLV Headers
| Type | Name | Description |
| :--- | :--- | :--- |
| `1` | **PID** | Packet ID (UUIDv7 recommended) |
| `2` | **TS** | Timestamp (Unix seconds, uint64) |
| `3` | **INTENT** | Operation name (e.g., `system.ping`) |
| `4` | **ACTOR** | Actor ID (UUID) |
| `7` | **NONCE** | Random nonce for replay protection |
| `8` | **AUD** | Audience (target service name) |
| `9` | **SIG** | Signature bytes |
| `10` | **PROOF_TYPE** | Proof type code (see §3.2) |
| `11` | **KID** | Key ID for signature verification |
| `12` | **BODY_HASH** | SHA-256 hash of the body |
| `13` | **TICKAUTH** | TickAuth challenge token |
| `15` | **RID** | Request/Receipt ID |

### 2.3 AXIS-JSON (Hardened JSON Frame)
For environments where binary is impractical, AXIS provides a hardened JSON representation.

```json
{
  "v": 1,
  "pid": "018f1234-5678-7000-8000-000000000001",
  "ts": 1703851200,
  "nonce": "abc123xyz...",
  "actorId": "user_uuid",
  "opcode": "INTENT.EXEC",
  "aud": "axis-core",
  "body": {
    "intent": "wallet.transfer",
    "args": { "amount": 100 },
    "capsule": { ... },
    "execNonce": "..."
  },
  "sig": {
    "alg": "EdDSA",
    "kid": "actor_key_id",
    "value": "base64url_signature..."
  }
}
```

#### Canonicalization (JCS)
To ensure deterministic signatures, JSON frames must be canonicalized:
1. Keys must be sorted alphabetically.
2. No unnecessary whitespace.
3. The `sig` field is excluded from the signature input.

### 2.4 Cryptography
- **Algorithm**: Ed25519 (EdDSA).
- **Key Format**: Raw 32-byte public keys.
- **Signature Input**:
  - **Binary**: `Magic + Version + Flags + Lens + Headers + Body`.
  - **JSON**: Canonical JSON string excluding the `sig` property.

### 2.5 Proof Types
| Code | Name | Capabilities Granted |
| :--- | :--- | :--- |
| `0` | **NONE** | Unauthenticated |
| `1` | **CAPSULE** | read, write, execute |
| `2` | **JWT** | read |
| `3` | **MTLS** | read, write, admin |
| `4` | **LOOM** | read, write, execute |
| `5` | **WITNESS** | read, write, execute, witness |

### 2.6 AXIS Opcodes
All opcodes are validated by the server. Unknown opcodes are rejected.

| Opcode | Description |
| :--- | :--- |
| `CAPSULE.ISSUE` | Issue a new capability capsule |
| `CAPSULE.BATCH` | Batch capsule issuance |
| `CAPSULE.REVOKE` | Revoke an existing capsule |
| `INTENT.EXEC` | Execute a wrapped intent |
| `ACTOR.KEY.ROTATE` | Rotate an actor's public key |
| `ACTOR.KEY.REVOKE` | Revoke an actor's public key |
| `ISSUER.KEY.ROTATE` | Rotate an issuer's public key |
| `AUTH.WEB.LOGIN` | NestFlow: Web login initiation |
| `AUTH.WEB.SCAN` | NestFlow: QR scan acknowledgment |
| `TICKAUTH.CREATE` | NestFlow: Create TickAuth challenge |
| `TICKAUTH.FULFILL` | NestFlow: Fulfill TickAuth challenge |
| `TICKAUTH.REJECT` | NestFlow: Reject TickAuth challenge |
| `SESSION.ACTIVATE` | NestFlow: Activate a session |
| `SESSION.REFRESH` | NestFlow: Refresh a session |
| `SESSION.LOGOUT` | NestFlow: Terminate a session |
| `DEVICE.TRUST` | NestFlow: Request device trust |
| `DEVICE.PROMOTE` | NestFlow: Promote device trust level |
| `DEVICE.REVOKE` | NestFlow: Revoke a device |
| `DEVICE.LIST` | NestFlow: List registered devices |
| `DEVICE.RENAME` | NestFlow: Rename a device |
| `IDENTITY.RECOVERY` | NestFlow: Identity recovery |
| `IDENTITY.LOCK` | NestFlow: Emergency identity freeze |

---

## 3. Security Architecture

### 3.1 The Sensor Chain
Every request passes through a chain of **33 sensors** before execution.

| Order | Sensor | Purpose |
| :--- | :--- | :--- |
| `5` | **ProtocolStrictSensor** | Validates magic bytes, version, and frame structure. |
| `10` | **FrameBudgetSensor** | Enforces header/body size limits and varint hardening. |
| `15` | **SigVerifySensor** | Validates Ed25519 signatures. |
| `20` | **ReplayProtectionSensor** | Detects duplicate nonces and timestamps. |
| `25` | **RateLimitSensor** | Enforces per-actor and per-IP rate limits. |
| `30` | **CapsuleVerifySensor** | Validates AXIS Capsules and enforces constraints. |
| `40` | **CountryBlockSensor** | Blocks requests from high-risk or unauthorized countries. |
| `140` | **RiskEvaluationSensor** | Calculates a risk score based on behavioral anomalies. |

### 3.2 AXIS Capsules
Capsules are hardened authorization tokens issued by an authoritative **Issuer**.

- **Payload**: `capsuleId` (ULID), `actorId`, `intent`, `scopes`, and `constraints`.
- **Type Discriminator**: Capsules carry an optional `type` field for NestFlow scoping: `login`, `device_registration`, `step_up`, `recovery`, or `general`.
- **Constraints**:
  - **Atomic Consumption**: Single-use enforcement.
  - **Geo-Binding**: Country-level restrictions.
  - **Device/Session Binding**: Restricts usage to specific `deviceId` or `sessionId`.
  - **Execution Nonce**: Prevents replay of the execution layer.

**Client-SDK Capsule API:**
```typescript
import {
  createCapsule,
  signCapsule,
  verifyCapsule,
  capsuleAllowsIntent,
  isCapsuleExpired,
  serializeCapsule,
  deserializeCapsule,
  generateCapsuleKeyPair,
} from '@nextera.one/axis-client-sdk';

const keys = generateCapsuleKeyPair();
const capsule = createCapsule({
  actorId: myActorBytes,
  intents: ['vault.*', 'file.upload'],
  ttlMs: 300_000,
  type: 'general', // optional NestFlow type
});
const signed = signCapsule(capsule, keys.privateKey);
```

### 3.3 Replay Protection & Audience Binding
- **Transport Level**: Frame `nonce` tracked in Redis.
- **Execution Level**: `execNonce` for `INTENT.EXEC` operations.
- **Audience Binding**: `aud` field prevents cross-service replay.

### 3.4 Capability Model
Intents require specific capabilities based on their operation pattern:

| Intent Pattern | Required Capabilities |
| :--- | :--- |
| `public.*`, `schema.*`, `catalog.*`, `health.*`, `system.*` | *(none)* |
| `file.upload`, `stream.publish` | write |
| `file.download`, `stream.subscribe` | read |
| `file.delete` | write, admin |
| `passport.issue` | write, execute |
| `passport.revoke` | write, witness |
| `auth.web.login.*`, `tickauth.challenge.*`, `session.*` | execute |
| `capsule.issue.*` | write, execute |
| `device.list` | read |
| `device.rename` | write |
| `device.trust.*`, `device.revoke` | write, execute |
| `identity.*`, `primary.device.*` | admin, execute |
| `secret.rotate`, `org.security.*` | admin |
| `admin.*` | admin |

### 3.5 Intent Sensitivity Classification
Every intent is classified by risk level, affecting logging, rate limiting, and approval thresholds.

| Level | Examples |
| :--- | :--- |
| **LOW** | `system.ping`, `catalog.*`, `device.list`, `session.logout` |
| **MEDIUM** | `stream.*`, `file.init`, `auth.web.login.request`, `session.refresh` |
| **HIGH** | `passport.issue`, `auth.web.login.scan`, `tickauth.challenge.fulfill`, `session.activate`, `device.trust.request` |
| **CRITICAL** | `passport.revoke`, `admin.*`, `device.trust.promote`, `device.revoke`, `capsule.issue.recovery`, `identity.*`, `secret.rotate`, `node.delete` |

---

## 4. NestFlow: Passwordless Authentication

NestFlow is the AXIS passwordless QR login system. The mobile device serves as the **primary trust anchor** — browsers never hold long-lived credentials.

### 4.1 Device Hierarchy

| Level | Device | Description |
| :--- | :--- | :--- |
| **Primary** | Mobile | Trust anchor. Approves all logins and step-ups. |
| **Trusted** | Promoted browser | Explicitly trusted by the primary device. Reduced step-up prompts. |
| **Ephemeral** | Session browser | Session-scoped. Disappears on logout or expiry. |

### 4.2 Auth Levels
Intents require a minimum auth level. Higher levels subsume lower ones.

```
SESSION  <  SESSION_BROWSER  <  STEP_UP  <  PRIMARY_DEVICE
```

| Auth Level | What is Required |
| :--- | :--- |
| `SESSION` | Valid session token |
| `SESSION_BROWSER` | Session + browser proof-of-possession (signed nonce) |
| `STEP_UP` | Session + fresh TickAuth fulfillment from primary device |
| `PRIMARY_DEVICE` | Request must originate from the primary device itself |

### 4.3 QR Login Flow

```
Browser                     Server                      Mobile (Primary)
   │                           │                              │
   │─── auth.web.login.request ──►│                              │
   │    (browser public key)   │                              │
   │◄── QR payload + challenge ─│                              │
   │                           │                              │
   │    [display QR code]      │                              │
   │                           │                              │
   │                           │◄── auth.web.login.scan ──────│
   │                           │    (challenge_uid)           │
   │                           │                              │
   │                           │◄── tickauth.challenge.fulfill│
   │                           │    (signed payload)          │
   │                           │                              │
   │                           │◄── capsule.issue.login ──────│
   │                           │    (browser + device bound)  │
   │                           │                              │
   │─── session.activate ─────►│                              │
   │    (capsule + browser proof)│                             │
   │◄── session token ─────────│                              │
```

**Client-SDK QR Login Helpers:**
```typescript
import {
  prepareWebLoginRequest,
  parseQrPayload,
  isQrPayloadExpired,
  buildScanRequest,
  createBrowserProof,
  buildSessionActivateRequest,
} from '@nextera.one/axis-client-sdk';

// Browser side: start login
const { browserKeyPair, request } = await prepareWebLoginRequest({
  origin: 'https://app.example.com',
  requestedTrust: 'ephemeral_session',
});

// Mobile side: scan & approve
const qr = parseQrPayload(scannedString);
if (!isQrPayloadExpired(qr)) {
  const scanReq = buildScanRequest(qr, deviceSigner, deviceUid);
}

// Browser side: complete login
const proof = await createBrowserProof(browserKeyPair.privateKey, serverNonce);
```

### 4.4 TickAuth: Temporal Authorization
TickAuth provides time-bound step-up authorization from a primary device. The mobile approves actions within a **tick window** (time fence).

```typescript
import {
  buildTickAuthPayload,
  signTickAuthPayload,
  buildTickAuthFulfillRequest,
  buildStepUpFulfillRequest,
  isWithinTickWindow,
  createTickWindow,
} from '@nextera.one/axis-client-sdk';

// Check if a challenge is still valid
const window = createTickWindow(30_000); // 30 seconds
if (isWithinTickWindow(window)) {
  const fulfillReq = await buildTickAuthFulfillRequest(
    qrPayload, challengeUid, deviceSigner, deviceUid,
  );
}

// Step-up for protected operations
const stepUp = await buildStepUpFulfillRequest(
  challengeUid, 'node.delete', deviceSigner, deviceUid,
);
```

### 4.5 Device Identity
Each device generates its own Ed25519 keypair. The public key is registered with the server.

```typescript
import {
  generateDeviceKeyPair,
  createDeviceIdentity,
  createDeviceSigner,
  verifyDeviceSignature,
} from '@nextera.one/axis-client-sdk';

const identity = await createDeviceIdentity({
  type: 'browser',
  name: 'Chrome on MacBook',
});
// identity.deviceUid — e.g. "dev_browser_a1b2c3..."
// identity.keyPair.publicKey — 32-byte Ed25519 public key
// identity.trustLevel — "ephemeral" (auto-assigned for browsers)
```

### 4.6 NestFlow Intent Policy Matrix
The server enforces auth level requirements per intent:

| Intent | Required Level |
| :--- | :--- |
| `auth.web.login.request` | SESSION |
| `auth.web.login.scan` | PRIMARY_DEVICE |
| `tickauth.challenge.create` | SESSION |
| `tickauth.challenge.fulfill` | PRIMARY_DEVICE |
| `tickauth.challenge.reject` | PRIMARY_DEVICE |
| `capsule.issue.*` | PRIMARY_DEVICE |
| `session.activate` | SESSION |
| `session.refresh` | SESSION_BROWSER |
| `session.logout` | SESSION |
| `device.list` | SESSION |
| `device.rename` | SESSION_BROWSER |
| `device.trust.request` | SESSION_BROWSER |
| `device.trust.promote` | STEP_UP |
| `device.revoke` | STEP_UP |
| `flow.publish` | SESSION_BROWSER |
| `flow.delete`, `node.delete`, `secret.rotate` | STEP_UP |
| `org.security.update`, `production.execution.approve` | STEP_UP |
| `identity.*`, `primary.device.rotate` | PRIMARY_DEVICE |

### 4.7 Server-Side Guards (Server SDK)
The server SDK provides composable guard functions for verifying NestFlow auth:

```typescript
import {
  checkIntentPolicy,
  checkSession,
  checkBrowserProof,
  checkDeviceTrust,
  checkCapsule,
  checkLoginChallenge,
  checkTickAuth,
  checkReplayProtection,
} from '@nextera.one/axis-server-sdk';

// Verify auth level meets intent requirement
const policyResult = checkIntentPolicy('device.revoke', currentAuthLevel);
if (!policyResult.allowed) {
  // policyResult.reason — human-readable denial
  // policyResult.step_up_intent — if step-up needed
}

// Validate session, browser proof, device trust
const sessionOk = checkSession(sessionContext);
const proofOk = checkBrowserProof(browserProof, serverNonce);
const trustOk = checkDeviceTrust(device, DeviceTrustLevel.TRUSTED);
```

### 4.8 State Machine Invariants (Server SDK)
All NestFlow entities follow strict state machines. The server SDK validates transitions:

```typescript
import {
  validateLoginChallengeTransition,
  validateSessionTransition,
  validateDeviceTransition,
  isSessionTerminal,
} from '@nextera.one/axis-server-sdk';

// LoginChallenge: PENDING → SCANNED → APPROVED (terminal)
const result = validateLoginChallengeTransition('pending', 'scanned');
// { valid: true }

const bad = validateLoginChallengeTransition('approved', 'pending');
// { valid: false, reason: "LoginChallenge: invalid transition 'approved' → 'pending'. Allowed: []" }

// Terminal state checks
isSessionTerminal('revoked'); // true
```

**Entity State Machines:**

| Entity | States | Terminal States |
| :--- | :--- | :--- |
| **LoginChallenge** | pending → scanned → approved/rejected/expired | approved, rejected, expired |
| **TickAuthChallenge** | pending → fulfilled/rejected/expired | fulfilled, rejected, expired |
| **Capsule** | active → consumed/revoked/expired | consumed, revoked, expired |
| **Session** | active → expired/revoked | expired, revoked |
| **Device** | active ↔ suspended → revoked | revoked |
| **TrustLink** | active → revoked | revoked |

---

## 5. Client SDK Reference

### 5.1 AxisClient
The primary client for sending intents over HTTP.

```typescript
import { AxisClient } from '@nextera.one/axis-client-sdk';

const client = new AxisClient({
  baseUrl: 'https://axis.example.com',
  actorId: 'user_abc123',
  audience: 'axis-core',       // default
  signer: myEd25519Signer,     // optional
  signerKid: 'key_001',        // required with signer
  maxRetries: 3,                // default
  retryDelayMs: 1000,           // default
  timeout: 30_000,              // default
});

// Simple intent
const res = await client.send('system.ping', {});

// Handler-scoped shorthand; wire intent is "vault...create"
const scoped = await client.send('create', { name: 'my-vault' }, {
  handlerName: 'vault',
});

// INTENT.EXEC wrapper with capsule
const res = await client.exec('vault.transfer', { amount: 100 }, {
  capsule: myCapsule,
  execNonce: 'unique-nonce',
});

// Chunked file upload with progress
const upload = await client.uploadFile('./data.bin', {
  chunkSize: 1024 * 1024,
  onProgress: (info) => console.log(`${info.percent}%`),
});

// File download
await client.downloadFile('file_abc', './output.bin');

// Stream tail (polling subscription)
const unsubscribe = await client.streamTail('events.audit', (event) => {
  console.log(event);
});
```

### 5.2 TypedAxisClient
Type-safe wrappers for all standard intents:

```typescript
import { TypedAxisClient } from '@nextera.one/axis-client-sdk';

const client = new TypedAxisClient(config);

// Passport
const passport = await client.passportIssue({ name: 'Alice', handle: 'alice' });
await client.passportRevoke({ passportId: passport.data.passportId });
const verified = await client.passportVerify({ passportId: '...' });

// Capsule
const cap = await client.capsuleCreate({ intents: ['vault.*'], expiresInMs: 300000 });
await client.capsuleRevoke({ capsuleId: cap.data.capsuleId, reason: 'compromised' });

// Files
const file = await client.fileInit({ filename: 'doc.pdf', size: 1024000 });
const status = await client.fileStatus({ fileId: file.data.fileId });
await client.fileAbort(file.data.fileId);

// Streams
await client.streamPublish({ topic: 'audit', event: { action: 'login' } });
const events = await client.streamRead({ topic: 'audit', offset: 0, limit: 100 });

// Catalog
const results = await client.catalogSearch('vault');
const desc = await client.catalogDescribe('vault.transfer');
const completions = await client.catalogComplete('vault.');

// NestFlow Auth
const login = await client.authWebLoginRequest({
  browser_public_key: pubKeyBase64,
  browser_key_algorithm: 'ed25519',
});
const session = await client.sessionActivate({
  login_challenge_uid: login.data.login_challenge.challenge_uid,
  capsule_uid: capsuleId,
  browser_proof: { server_nonce: nonce, signature: sig, signature_algorithm: 'ed25519' },
});
await client.sessionLogout({ reason: 'user-initiated' });

// NestFlow Device Management
const devices = await client.deviceList();
await client.deviceRevoke({ target_device_uid: 'dev_123', reason: 'lost' });
```

### 5.3 Binary Transport
For direct binary frame communication:

```typescript
import { AxisBinaryClient, Ed25519Signer } from '@nextera.one/axis-client-sdk';

const client = new AxisBinaryClient({
  // low-level binary transport options
});
```

### 5.4 TLV & REST Bridge
Convert REST requests to AXIS frames for proxy scenarios:

```typescript
import { AxisRestBridge, AxisProxyClient, pack, unpack } from '@nextera.one/axis-client-sdk';

// TLV pack/unpack
const tlvBytes = pack([
  { tag: 3, value: new TextEncoder().encode('system.ping') },
  { tag: 7, value: crypto.getRandomValues(new Uint8Array(16)) },
]);
const entries = unpack(tlvBytes);
```

---

## 6. Server SDK Reference

### 6.1 Decorators & Intent Routing

```typescript
import { Handler, Intent, IntentRouter } from '@nextera.one/axis-server-sdk';

@Handler('vault')
class VaultHandler {
  @Intent('create')
  async create(body: Uint8Array) {
    // handles 'vault.create'
    return { id: 'v_new' };
  }

  @Intent('admin.rotate-key', { absolute: true })
  async rotateKey(body: Uint8Array) {
    // handles 'admin.rotate-key' (absolute path)
  }

  @Intent('transfer', { frame: true })
  async transfer(frame: AxisFrame) {
    // receives full frame for custom validation
  }
}

const router = new IntentRouter();
router.registerHandler(new VaultHandler());
const result = await router.dispatch('vault.create', bodyBytes);
// Clients may also send the scoped wire form "vault...create".
```

### 6.2 Sensor Pipeline
Implement custom sensors for the security chain:

```typescript
import {
  AxisSensor,
  Decision,
  SensorInput,
  normalizeSensorDecision,
} from '@nextera.one/axis-server-sdk';

class CustomSensor implements AxisSensor {
  order = 35;
  phase = 'PRE_DECODE';

  async evaluate(input: SensorInput) {
    if (isBlocked(input)) {
      return { action: Decision.DENY, reason: 'custom block' };
    }
    return { action: Decision.ALLOW };
  }
}
```

### 6.3 Execution Contracts
Per-intent resource limits:

```typescript
import { ExecutionContract, DEFAULT_CONTRACTS } from '@nextera.one/axis-server-sdk';

// Each intent can have limits:
// maxDbWrites, maxTimeMs, allowedEffects
const contract = DEFAULT_CONTRACTS['passport.issue'];
// { maxDbWrites: 5, maxTimeMs: 2000, allowedEffects: ['db.write', 'event.emit'] }
```

### 6.4 Frame Validation & Encoding

```typescript
import {
  encodeFrame,
  decodeFrame,
  getSignTarget,
  validateFrameShape,
  isTimestampValid,
  buildReceiptHash,
} from '@nextera.one/axis-server-sdk';

// Encode a frame
const wire = encodeFrame(frame);

// Decode and validate
const decoded = decodeFrame(wire);
const valid = validateFrameShape(decoded);
const tsOk = isTimestampValid(decoded.ts, 30_000); // 30s skew

// Build receipt hash chain
const receiptHash = buildReceiptHash(prevHash, frameDigest);
```

### 6.5 Scope Validation (BOLA Prevention)

```typescript
import { hasScope, canAccessResource, parseScope } from '@nextera.one/axis-server-sdk';

const scopes = ['wallet:w_123', 'merchant:*'];

hasScope(scopes, 'wallet:w_123');           // true
hasScope(scopes, 'wallet:w_999');           // false
canAccessResource(scopes, 'merchant', 'm_1'); // true (wildcard)
```

### 6.6 NestFlow Server Integration

```typescript
import {
  // Guards
  checkIntentPolicy,
  checkSession,
  checkBrowserProof,
  checkDeviceTrust,
  checkCapsule,
  checkTickAuth,
  checkReplayProtection,

  // Policy
  getRequiredAuthLevel,
  satisfiesAuthLevel,
  NESTFLOW_POLICY_MAP,

  // Intents
  NESTFLOW_INTENTS,
  isNestFlowIntent,

  // Invariants
  validateLoginChallengeTransition,
  validateSessionTransition,
  validateCapsuleTransition,

  // Types
  AuthLevel,
  DeviceTrustLevel,
  SessionStatus,
  LoginChallengeStatus,
} from '@nextera.one/axis-server-sdk';
```

---

## 7. Database Schema

### 7.1 Identity and Keys
- **`axis_actor_keys`**: Stores public keys for actors.
- **`axis_root_certificates`**: Stores root certificates for node identity and issuer trust.
- **`axis_node_identities`**: Stores node identity information and certificates.
- **`axis_issuer_keys`**: Stores public keys for authoritative issuers.

### 7.2 Security State
- **`axis_capsules`**: Tracks lifecycle and consumption of capsules.
- **`axis_blocklist`**: Global blocklist for IPs, Actors, and Capsules.
- **`axis_packet_denylist`**: Tracks denied packets for replay protection.
- **`axis_anomaly_state`**: Tracks behavioral patterns for risk scoring.

### 7.3 Intent Registry
- **`axis_intents_registry`**: Registry of all available intents.
- **`axis_intent_policy`**: Policy rules for intent execution.
- **`axis_intent_schemas`**: JSON schemas for intent validation.

### 7.4 Audit and Compliance
- **`axis_receipts`**: Immutable records of every operation, linked via hash chain.
- **`axis_sensor_logs`**: Detailed logs from the sensor chain.
- **`axis_traces`**: Execution traces for debugging and auditing.
- **`axis_metrics`**: Performance and operational metrics.

### 7.5 Files and Streams
- **`axis_files`**: File metadata and storage references.
- **`axis_upload_sessions`**: Chunked upload session tracking.
- **`axis_stream_events`**: Event stream storage.
- **`axis_stream_subscriptions`**: Stream subscription management.

---

## 8. CLI Reference

### 8.1 Installation
```bash
npm install -g @nextera.one/axis-cli
# or link locally
cd axis-cli && npm link
```

### 8.2 Commands

#### `axis send <intent> [body]`
Send an arbitrary intent to an AXIS node.

```bash
# Simple ping
axis send system.ping

# Send with JSON body
axis send vault.create '{"name":"my-vault"}'

# Send handler-scoped shorthand as vault...create
axis send create '{"name":"my-vault"}' --handler vault

# Signed request with capsule
axis send vault.transfer '{"amount":100}' \
  -k <private-key-hex> --kid key_001 \
  --capsule ./my.capsule --exec
```

| Option | Description | Default |
| :--- | :--- | :--- |
| `-e, --endpoint <url>` | Axis base URL | `http://localhost:3000` |
| `-a, --actor <id>` | Actor ID | `actor:cli` |
| `--audience <aud>` | Audience for frame | `axis-core` |
| `-k, --key <hex>` | Ed25519 private key (hex) | — |
| `--kid <kid>` | Key ID for signature | — |
| `--exec` | Wrap in INTENT.EXEC | — |
| `--capsule <jsonOrPath>` | Capsule JSON or file path | — |

#### `axis file`
File upload and management operations.

#### `axis stream`
Stream publish, read, and subscribe operations.

#### `axis issue-node-cert`
Generate a new node identity (Ed25519 keypair + node ID).

```bash
axis issue-node-cert -o ./keys
# Outputs: node-identity.json, node-identity.key
```

#### `axis device list`
List all registered devices for the current identity.

```bash
axis device list -e https://axis.example.com -k <key-hex> --kid key_001
```

#### `axis device revoke <device_uid>`
Revoke a registered device.

```bash
axis device revoke dev_browser_a1b2c3 --reason "lost device"
```

#### `axis session logout`
Terminate the current session.

```bash
axis session logout --reason "user-initiated"
```

#### `axis identity lock`
Emergency freeze — locks the identity and revokes all sessions.

```bash
axis identity lock -k <primary-device-key-hex> --kid key_001
```

#### `axis identity unlock`
Unlock a previously locked identity.

```bash
axis identity unlock -k <primary-device-key-hex> --kid key_001
```

---

## 9. Developer Guides

### 9.1 NestJS Backend Integration
- **Project Structure**: `src/engine` (Execution + Sensors), `src/security` (Enforcement), `src/crypto` (Keys + Signing), `src/axis` (Entities).
- **Adding Opcodes**: Define in `axis-opcodes.ts` and register with `AxisOpcodeRouterService`.
- **Adding Sensors**: Implement `AxisSensor` interface in `src/engine/sensors` and register in `AxisEngineModule`.
- **Unified Ingress**: `AxisController` handles both binary and JSON via `AxisObservedContextMiddleware`.
- **Adding NestFlow Handlers**: Use `@Handler` and `@Intent` decorators. Compose guard functions from the server SDK for auth enforcement.

### 9.2 Generic Implementation
- **Varints (LEB128)**: Used for all length prefixes.
- **TLV**: Headers are `[Type: Varint][Length: Varint][Value: Bytes]`.
- **JCS**: Implement deterministic JSON serializer (sorted keys, no whitespace).
- **INTENT.EXEC**: Wrap `intent`, `args`, `capsule`, and `execNonce` in an outer frame signed by the actor.

### 9.3 Implementing NestFlow in a New Backend
1. **Register NestFlow intents** using `NESTFLOW_INTENTS` constants.
2. **Enforce auth levels** using `NESTFLOW_POLICY_MAP` and `checkIntentPolicy()`.
3. **Validate state transitions** using `validateLoginChallengeTransition()`, etc.
4. **Implement guards** using the composable guard functions (`checkSession`, `checkBrowserProof`, `checkDeviceTrust`, `checkCapsule`, `checkTickAuth`).
5. **Implement a `NonceStore`** for replay protection (e.g., Redis-backed).
6. **Store device public keys** and validate browser proofs cryptographically.

### 9.4 Quick Start
```bash
# Start the backend
cd axis-backend && ./start.sh

# Ping the node
axis send system.ping

# List available intents
axis send catalog.search '*'

# Issue a node certificate
axis issue-node-cert -o ./keys

# List devices
axis device list
```
