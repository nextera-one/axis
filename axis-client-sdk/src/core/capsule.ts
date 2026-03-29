/**
 * AXIS Capsule Service
 *
 * Capsules are short-lived cryptographic bearer tokens used for proof-of-authority.
 * They are registered with the backend and used as PROOF_REF in AXIS frames.
 *
 * @module capsule
 */
import * as crypto from 'crypto';

/**
 * Capsule structure
 */
export interface Capsule {
  /** Unique 16-byte capsule identifier */
  id: Uint8Array;
  /** Actor ID this capsule is bound to */
  actorId: Uint8Array;
  /** Capsule type discriminator for NestFlow scoping */
  type?: 'login' | 'device_registration' | 'step_up' | 'recovery' | 'general';
  /** List of allowed intents (supports wildcards like 'vault.*') */
  intents: string[];
  /** Issued at timestamp (milliseconds) */
  issuedAt: bigint;
  /** Expires at timestamp (milliseconds) */
  expiresAt: bigint;
  /** Optional realm restriction */
  realm?: string;
  /** Optional node restriction */
  node?: string;
  /** Signature over capsule payload */
  signature?: Uint8Array;
}

/**
 * Serialized capsule for transmission
 */
export interface SerializedCapsule {
  id: string; // hex-encoded
  actorId: string; // hex-encoded
  type?: string;
  intents: string[];
  issuedAt: string; // decimal string
  expiresAt: string; // decimal string
  realm?: string;
  node?: string;
  signature?: string; // hex-encoded
}

/**
 * Options for creating a new capsule
 */
export interface CapsuleCreateOptions {
  /** Actor ID (16 bytes, typically a UUID) */
  actorId: Uint8Array;
  /** List of allowed intents. Supports wildcards. */
  intents?: string[];
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Optional realm restriction */
  realm?: string;
  /** Optional node restriction */
  node?: string;
  /** Private key for signing (Ed25519 seed or PKCS8) */
  privateKey?: Uint8Array;
}

/**
 * Creates a new unsigned capsule
 *
 * @param options - Capsule creation options
 * @returns Unsigned capsule
 *
 * @example
 * ```typescript
 * const capsule = createCapsule({
 *   actorId: uuidToBytes('550e8400-e29b-41d4-a716-446655440000'),
 *   intents: ['vault.*', 'system.ping'],
 *   ttlMs: 300000, // 5 minutes
 * });
 * ```
 */
export function createCapsule(options: CapsuleCreateOptions): Capsule {
  const {
    actorId,
    intents = ['*'],
    ttlMs = 5 * 60 * 1000, // 5 minutes default
    realm,
    node,
  } = options;

  if (actorId.length !== 16) {
    throw new Error('Actor ID must be 16 bytes');
  }

  // Generate random 16-byte capsule ID
  const id = crypto.randomBytes(16);

  // Calculate timestamps
  const issuedAt = BigInt(Date.now());
  const expiresAt = issuedAt + BigInt(ttlMs);

  return {
    id: new Uint8Array(id),
    actorId,
    intents,
    issuedAt,
    expiresAt,
    realm,
    node,
  };
}

/**
 * Computes the canonical bytes for signing a capsule
 *
 * @param capsule - The capsule to compute signature payload for
 * @returns Binary payload for signing
 */
export function getCapsuleSignaturePayload(capsule: Capsule): Uint8Array {
  // Create canonical JSON representation (sorted keys)
  const payload = {
    id: Buffer.from(capsule.id).toString('hex'),
    actorId: Buffer.from(capsule.actorId).toString('hex'),
    intents: [...capsule.intents].sort(),
    iat: capsule.issuedAt.toString(),
    exp: capsule.expiresAt.toString(),
    ...(capsule.realm && { realm: capsule.realm }),
    ...(capsule.node && { node: capsule.node }),
  };

  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Signs a capsule with an Ed25519 private key
 *
 * @param capsule - The capsule to sign
 * @param privateKey - Ed25519 private key (32-byte seed or PKCS8 DER)
 * @returns Signed capsule with signature attached
 *
 * @example
 * ```typescript
 * const signedCapsule = signCapsule(capsule, myPrivateKey);
 * // signedCapsule.signature is now set
 * ```
 */
export function signCapsule(capsule: Capsule, privateKey: Uint8Array): Capsule {
  const payload = getCapsuleSignaturePayload(capsule);

  let keyObject: crypto.KeyObject;

  if (privateKey.length === 32) {
    // Raw 32-byte seed - wrap in PKCS8
    const pkcs8Prefix = Buffer.from([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
    ]);
    const pkcs8Key = Buffer.concat([pkcs8Prefix, Buffer.from(privateKey)]);

    keyObject = crypto.createPrivateKey({
      key: pkcs8Key,
      format: 'der',
      type: 'pkcs8',
    });
  } else {
    // Assume already PKCS8 DER
    keyObject = crypto.createPrivateKey({
      key: Buffer.from(privateKey),
      format: 'der',
      type: 'pkcs8',
    });
  }

  const signature = crypto.sign(null, payload, keyObject);

  return {
    ...capsule,
    signature: new Uint8Array(signature),
  };
}

/**
 * Verifies a capsule signature
 *
 * @param capsule - The signed capsule to verify
 * @param publicKey - Ed25519 public key (32-byte raw or SPKI DER)
 * @returns True if signature is valid
 */
export function verifyCapsule(
  capsule: Capsule,
  publicKey: Uint8Array,
): boolean {
  if (!capsule.signature || capsule.signature.length !== 64) {
    return false;
  }

  const payload = getCapsuleSignaturePayload(capsule);

  try {
    let keyObject: crypto.KeyObject;

    if (publicKey.length === 32) {
      // Raw 32-byte key - wrap in SPKI
      const spkiPrefix = Buffer.from([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
      ]);
      const spkiKey = Buffer.concat([spkiPrefix, Buffer.from(publicKey)]);

      keyObject = crypto.createPublicKey({
        key: spkiKey,
        format: 'der',
        type: 'spki',
      });
    } else {
      keyObject = crypto.createPublicKey({
        key: Buffer.from(publicKey),
        format: 'der',
        type: 'spki',
      });
    }

    return crypto.verify(
      null,
      payload,
      keyObject,
      Buffer.from(capsule.signature),
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a capsule is expired
 *
 * @param capsule - The capsule to check
 * @param clockSkewMs - Allowed clock skew in milliseconds (default: 30 seconds)
 * @returns True if expired
 */
export function isCapsuleExpired(
  capsule: Capsule,
  clockSkewMs = 30000,
): boolean {
  const now = BigInt(Date.now());
  return now > capsule.expiresAt + BigInt(clockSkewMs);
}

/**
 * Checks if a capsule allows a specific intent
 *
 * @param capsule - The capsule to check
 * @param intent - The intent to check (e.g., 'vault.create')
 * @returns True if intent is allowed
 *
 * @example
 * ```typescript
 * const capsule = createCapsule({ actorId, intents: ['vault.*'] });
 * capsuleAllowsIntent(capsule, 'vault.create'); // true
 * capsuleAllowsIntent(capsule, 'system.ping');  // false
 * ```
 */
export function capsuleAllowsIntent(capsule: Capsule, intent: string): boolean {
  for (const pattern of capsule.intents) {
    if (pattern === '*') {
      return true;
    }

    if (pattern === intent) {
      return true;
    }

    // Wildcard matching (e.g., 'vault.*' matches 'vault.create')
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1); // Remove '*'
      if (intent.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Serializes a capsule for transmission (to JSON-friendly format)
 *
 * @param capsule - The capsule to serialize
 * @returns Serialized capsule with hex-encoded binary fields
 */
export function serializeCapsule(capsule: Capsule): SerializedCapsule {
  return {
    id: Buffer.from(capsule.id).toString('hex'),
    actorId: Buffer.from(capsule.actorId).toString('hex'),
    ...(capsule.type && { type: capsule.type }),
    intents: capsule.intents,
    issuedAt: capsule.issuedAt.toString(),
    expiresAt: capsule.expiresAt.toString(),
    ...(capsule.realm && { realm: capsule.realm }),
    ...(capsule.node && { node: capsule.node }),
    ...(capsule.signature && {
      signature: Buffer.from(capsule.signature).toString('hex'),
    }),
  };
}

/**
 * Deserializes a capsule from JSON-friendly format
 *
 * @param data - Serialized capsule data
 * @returns Deserialized capsule
 */
export function deserializeCapsule(data: SerializedCapsule): Capsule {
  return {
    id: new Uint8Array(Buffer.from(data.id, 'hex')),
    actorId: new Uint8Array(Buffer.from(data.actorId, 'hex')),
    ...(data.type && { type: data.type as Capsule['type'] }),
    intents: data.intents,
    issuedAt: BigInt(data.issuedAt),
    expiresAt: BigInt(data.expiresAt),
    realm: data.realm,
    node: data.node,
    signature: data.signature
      ? new Uint8Array(Buffer.from(data.signature, 'hex'))
      : undefined,
  };
}

/**
 * Computes SHA-256 hash of a capsule (for lookup/caching)
 *
 * @param capsule - The capsule to hash
 * @returns 32-byte hash
 */
export function hashCapsule(capsule: Capsule): Uint8Array {
  const payload = getCapsuleSignaturePayload(capsule);
  const hash = crypto.createHash('sha256').update(payload).digest();
  return new Uint8Array(hash);
}

/**
 * Generates a new Ed25519 key pair for capsule signing
 *
 * @returns Key pair with 32-byte seed and public key
 */
export function generateCapsuleKeyPair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  // Export as raw bytes
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer;
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;

  // Extract 32-byte raw keys from DER
  // PKCS8 Ed25519: header is 16 bytes, key is last 32 bytes
  // SPKI Ed25519: header is 12 bytes, key is last 32 bytes
  const rawPrivate = privDer.subarray(privDer.length - 32);
  const rawPublic = pubDer.subarray(pubDer.length - 32);

  return {
    privateKey: new Uint8Array(rawPrivate),
    publicKey: new Uint8Array(rawPublic),
  };
}
