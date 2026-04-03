import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as nacl from 'tweetnacl';

/**
 * Proof Verification Service
 *
 * Verifies proof types according to AXIS spec:
 * - CAPSULE (1): Capability token verification
 * - JWT (2): JSON Web Token verification
 * - MTLS_ID (3): mTLS client certificate verification
 * - DEVICE_SE (4): Device Secure Element signature verification
 *
 * Related: AXIS spec - Proof Types
 */

export type ProofType = 1 | 2 | 3 | 4; // CAPSULE, JWT, MTLS_ID, DEVICE_SE

export interface ProofVerificationResult {
  valid: boolean;
  actorId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MTLSContext {
  clientCertPem?: string;
  clientCertFingerprint?: string;
  clientCertSubject?: string;
  clientCertIssuer?: string;
  verified?: boolean;
}

export interface DeviceSEContext {
  deviceId: string;
  signature: Uint8Array;
  publicKey: Uint8Array;
  challenge?: Uint8Array;
}

@Injectable()
export class ProofVerificationService {
  private readonly logger = new Logger(ProofVerificationService.name);

  // Cache of registered device public keys (deviceId -> pubKey)
  private readonly deviceKeys = new Map<string, Uint8Array>();

  // Cache of trusted mTLS certificate fingerprints
  private readonly trustedCerts = new Map<
    string,
    { actorId: string; issuedAt: number }
  >();

  /**
   * Verifies an authentication proof based on its type.
   *
   * **Supported Types:**
   * - 1 (CAPSULE): Delegated to `verifyCapsuleProof`
   * - 2 (JWT): Verified by `verifyJWTProof`
   * - 3 (MTLS_ID): Verified by `verifyMTLSProof`
   * - 4 (DEVICE_SE): Verified by `verifyDeviceSEProof`
   *
   * @param {ProofType} proofType - The numeric AXIS proof type
   * @param {Uint8Array} proofRef - The binary reference or token for the proof
   * @param {Object} context - Additional metadata required for specific proof types
   * @param {Uint8Array} [context.signTarget] - The canonical bytes that were signed (for Ed25519)
   * @param {Uint8Array} [context.signature] - The signature to verify (for Ed25519)
   * @param {MTLSContext} [context.mtls] - mTLS certificate data
   * @param {DeviceSEContext} [context.deviceSE] - Device Secure Element information
   * @returns {Promise<ProofVerificationResult>} The outcome of the verification
   */
  async verifyProof(
    proofType: ProofType,
    proofRef: Uint8Array,
    context: {
      signTarget?: Uint8Array;
      signature?: Uint8Array;
      mtls?: MTLSContext;
      deviceSE?: DeviceSEContext;
    },
  ): Promise<ProofVerificationResult> {
    switch (proofType) {
      case 1: // CAPSULE
        return this.verifyCapsuleProof(proofRef);
      case 2: // JWT
        return this.verifyJWTProof(proofRef);
      case 3: // MTLS_ID
        return this.verifyMTLSProof(context.mtls);
      case 4: // DEVICE_SE
        return this.verifyDeviceSEProof(
          context.signTarget,
          context.signature,
          context.deviceSE,
        );
      default:
        return { valid: false, error: `Unknown proof type: ${proofType}` };
    }
  }

  /**
   * Verify CAPSULE proof (delegated to CapsuleService)
   */
  private async verifyCapsuleProof(
    proofRef: Uint8Array,
  ): Promise<ProofVerificationResult> {
    // Capsule verification is handled by CapsuleService
    // This is a pass-through that returns valid to signal capsule processing
    const capsuleId = new TextDecoder().decode(proofRef);
    return {
      valid: true,
      metadata: { capsuleId, requiresCapsuleValidation: true },
    };
  }

  /**
   * Verifies a JSON Web Token (JWT) proof.
   *
   * **Validation Logic:**
   * 1. Decodes the token string.
   * 2. Checks for valid 3-part JWT structure.
   * 3. Validates `exp` (expiration) and `nbf` (not before) claims.
   * 4. Extracts `actor_id` or `sub` as the identity.
   *
   * @param {Uint8Array} proofRef - Binary representation of the JWT string
   * @returns {Promise<ProofVerificationResult>} Result including the actor identifier
   */
  private async verifyJWTProof(
    proofRef: Uint8Array,
  ): Promise<ProofVerificationResult> {
    try {
      const token = new TextDecoder().decode(proofRef);
      const parts = token.split('.');

      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      // Decode header and payload
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Check expiration
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return { valid: false, error: 'JWT expired' };
      }

      // Check not before
      if (payload.nbf && Date.now() / 1000 < payload.nbf) {
        return { valid: false, error: 'JWT not yet valid' };
      }

      // For production: verify signature against known keys
      // For now, we trust the JWT if it has valid structure and timing
      return {
        valid: true,
        actorId: payload.sub || payload.actor_id,
        metadata: { iss: payload.iss, scope: payload.scope },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { valid: false, error: `JWT parse error: ${message}` };
    }
  }

  /**
   * Verify mTLS client certificate proof
   */
  private async verifyMTLSProof(
    mtls?: MTLSContext,
  ): Promise<ProofVerificationResult> {
    if (!mtls) {
      return { valid: false, error: 'No mTLS context provided' };
    }

    // Check if connection was verified by TLS layer
    if (!mtls.verified) {
      return { valid: false, error: 'mTLS not verified by TLS terminator' };
    }

    // Check certificate fingerprint against trusted list
    if (mtls.clientCertFingerprint) {
      const trusted = this.trustedCerts.get(mtls.clientCertFingerprint);
      if (trusted) {
        return {
          valid: true,
          actorId: trusted.actorId,
          metadata: {
            fingerprint: mtls.clientCertFingerprint,
            subject: mtls.clientCertSubject,
          },
        };
      }
    }

    // Extract actor ID from certificate subject (CN field)
    if (mtls.clientCertSubject) {
      const cnMatch = mtls.clientCertSubject.match(/CN=([^,]+)/);
      if (cnMatch) {
        return {
          valid: true,
          actorId: cnMatch[1],
          metadata: {
            subject: mtls.clientCertSubject,
            issuer: mtls.clientCertIssuer,
          },
        };
      }
    }

    return { valid: false, error: 'Could not extract actor from certificate' };
  }

  /**
   * Verify Device Secure Element signature
   */
  private async verifyDeviceSEProof(
    signTarget?: Uint8Array,
    signature?: Uint8Array,
    deviceSE?: DeviceSEContext,
  ): Promise<ProofVerificationResult> {
    if (!deviceSE || !signTarget || !signature) {
      return { valid: false, error: 'Missing Device SE context' };
    }

    // Get registered public key for device
    let publicKey = deviceSE.publicKey;

    // If device is pre-registered, use registered key
    const registeredKey = this.deviceKeys.get(deviceSE.deviceId);
    if (registeredKey) {
      publicKey = registeredKey;
    }

    if (!publicKey || publicKey.length !== 32) {
      return {
        valid: false,
        error: 'Invalid or unregistered device public key',
      };
    }

    // Verify Ed25519 signature
    try {
      const valid = nacl.sign.detached.verify(signTarget, signature, publicKey);

      if (!valid) {
        return { valid: false, error: 'Device signature verification failed' };
      }

      return {
        valid: true,
        actorId: deviceSE.deviceId,
        metadata: { deviceId: deviceSE.deviceId, proofType: 'DEVICE_SE' },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return {
        valid: false,
        error: `Signature verification error: ${message}`,
      };
    }
  }

  /**
   * Registers a public key for a trusted device.
   * This key will be used for future `DEVICE_SE` proof verifications.
   *
   * @param {string} deviceId - Unique identifier for the device
   * @param {Uint8Array} publicKey - 32-byte Ed25519 public key
   * @throws {Error} If the public key is not 32 bytes
   */
  registerDeviceKey(deviceId: string, publicKey: Uint8Array): void {
    if (publicKey.length !== 32) {
      throw new Error('Device public key must be 32 bytes (Ed25519)');
    }
    this.deviceKeys.set(deviceId, publicKey);
    this.logger.log(`Registered device key for ${deviceId}`);
  }

  /**
   * Unregister a device
   */
  unregisterDevice(deviceId: string): boolean {
    return this.deviceKeys.delete(deviceId);
  }

  /**
   * Registers a trusted mTLS certificate fingerprint and associates it with an actor.
   *
   * @param {string} fingerprint - SHA-256 fingerprint of the client certificate
   * @param {string} actorId - The actor to associate with this certificate
   */
  registerMTLSCert(fingerprint: string, actorId: string): void {
    this.trustedCerts.set(fingerprint, { actorId, issuedAt: Date.now() });
    this.logger.log(`Registered mTLS cert ${fingerprint} for actor ${actorId}`);
  }

  /**
   * Revoke an mTLS certificate
   */
  revokeMTLSCert(fingerprint: string): boolean {
    return this.trustedCerts.delete(fingerprint);
  }

  /**
   * Calculate certificate fingerprint (SHA-256)
   */
  static calculateFingerprint(certPem: string): string {
    // Extract DER from PEM
    const der = Buffer.from(
      certPem
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\s/g, ''),
      'base64',
    );
    return crypto.createHash('sha256').update(der).digest('hex');
  }
}
