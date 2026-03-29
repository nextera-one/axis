/**
 * NestFlow Device Identity Management
 *
 * Handles device keypair generation, storage, and lifecycle.
 * Each device (mobile/web/desktop) gets its own Ed25519 keypair.
 * The mobile app holds the primary key; browsers get ephemeral or
 * promoted-trusted keys.
 */
import { Ed25519Signer, Signer } from '../signer';
import { DeviceIdentity, DeviceStatus, DeviceTrustLevel, DeviceType } from './types';

/** Options for creating a new device identity */
export interface CreateDeviceOptions {
  name: string;
  type: DeviceType;
  platform?: string;
  trustLevel?: DeviceTrustLevel;
}

/** Result of device keypair generation */
export interface DeviceKeyPair {
  privateKey: Uint8Array; // 32-byte Ed25519 seed
  publicKey: Uint8Array; // 32-byte Ed25519 public key
}

/**
 * Generate a fresh Ed25519 keypair for a device.
 * Uses Web Crypto for random bytes to ensure cryptographic quality.
 */
export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);

  const signer = new Ed25519Signer(privateKey);
  const publicKey = await signer.getPublicKey();

  return { privateKey, publicKey };
}

/**
 * Create a Signer instance from a device's private key.
 */
export function createDeviceSigner(privateKey: Uint8Array): Signer {
  return new Ed25519Signer(privateKey);
}

/**
 * Generate a unique device UID.
 * Format: dev_{type}_{random hex}
 */
export function generateDeviceUid(type: DeviceType): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `dev_${type}_${hex}`;
}

/**
 * Build a DeviceIdentity descriptor from a newly generated keypair.
 */
export async function createDeviceIdentity(
  opts: CreateDeviceOptions,
): Promise<{ identity: DeviceIdentity; privateKey: Uint8Array }> {
  const keyPair = await generateDeviceKeyPair();
  const deviceUid = generateDeviceUid(opts.type);

  const identity: DeviceIdentity = {
    deviceUid,
    name: opts.name,
    type: opts.type,
    platform: opts.platform,
    trustLevel:
      opts.trustLevel ??
      (opts.type === DeviceType.MOBILE
        ? DeviceTrustLevel.PRIMARY
        : DeviceTrustLevel.EPHEMERAL),
    status: DeviceStatus.PENDING,
    publicKey: toBase64(keyPair.publicKey),
    keyAlgorithm: 'ed25519',
    createdAt: new Date().toISOString(),
  };

  return { identity, privateKey: keyPair.privateKey };
}

/**
 * Verify that a device's public key matches a signature.
 * Used for browser proof-of-possession verification on the client side.
 */
export async function verifyDeviceSignature(
  publicKeyBase64: string,
  message: Uint8Array,
  signature: Uint8Array,
): Promise<boolean> {
  const { verify } = await import('@noble/ed25519');
  const publicKey = fromBase64(publicKeyBase64);
  return verify(signature, message, publicKey);
}

// ---------------------------------------------------------------------------
// Base64 helpers (URL-safe)
// ---------------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  const binStr = String.fromCharCode(...bytes);
  return btoa(binStr)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binStr = atob(padded);
  return Uint8Array.from(binStr, (c) => c.charCodeAt(0));
}
