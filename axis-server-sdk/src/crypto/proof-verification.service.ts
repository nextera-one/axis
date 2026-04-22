import * as crypto from "crypto";
import * as nacl from "tweetnacl";
import { createAxisLogger } from "../utils/axis-logger";

export type ProofType = 1 | 2 | 3 | 4;

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

export class ProofVerificationService {
  private readonly logger = createAxisLogger(ProofVerificationService.name);

  private readonly deviceKeys = new Map<string, Uint8Array>();
  private readonly trustedCerts = new Map<
    string,
    { actorId: string; issuedAt: number }
  >();

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
      case 1:
        return this.verifyCapsuleProof(proofRef);
      case 2:
        return this.verifyJWTProof(proofRef);
      case 3:
        return this.verifyMTLSProof(context.mtls);
      case 4:
        return this.verifyDeviceSEProof(
          context.signTarget,
          context.signature,
          context.deviceSE,
        );
      default:
        return { valid: false, error: `Unknown proof type: ${proofType}` };
    }
  }

  private async verifyCapsuleProof(
    proofRef: Uint8Array,
  ): Promise<ProofVerificationResult> {
    const capsuleId = new TextDecoder().decode(proofRef);
    return {
      valid: true,
      metadata: { capsuleId, requiresCapsuleValidation: true },
    };
  }

  private async verifyJWTProof(
    proofRef: Uint8Array,
  ): Promise<ProofVerificationResult> {
    try {
      const token = new TextDecoder().decode(proofRef);
      const parts = token.split(".");

      if (parts.length !== 3) {
        return { valid: false, error: "Invalid JWT format" };
      }

      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return { valid: false, error: "JWT expired" };
      }

      if (payload.nbf && Date.now() / 1000 < payload.nbf) {
        return { valid: false, error: "JWT not yet valid" };
      }

      return {
        valid: true,
        actorId: payload.sub || payload.actor_id,
        metadata: { iss: payload.iss, scope: payload.scope },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return { valid: false, error: `JWT parse error: ${message}` };
    }
  }

  private async verifyMTLSProof(
    mtls?: MTLSContext,
  ): Promise<ProofVerificationResult> {
    if (!mtls) {
      return { valid: false, error: "No mTLS context provided" };
    }

    if (!mtls.verified) {
      return { valid: false, error: "mTLS not verified by TLS terminator" };
    }

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

    return { valid: false, error: "Could not extract actor from certificate" };
  }

  private async verifyDeviceSEProof(
    signTarget?: Uint8Array,
    signature?: Uint8Array,
    deviceSE?: DeviceSEContext,
  ): Promise<ProofVerificationResult> {
    if (!deviceSE || !signTarget || !signature) {
      return { valid: false, error: "Missing Device SE context" };
    }

    let publicKey = deviceSE.publicKey;

    const registeredKey = this.deviceKeys.get(deviceSE.deviceId);
    if (registeredKey) {
      publicKey = registeredKey;
    }

    if (!publicKey || publicKey.length !== 32) {
      return {
        valid: false,
        error: "Invalid or unregistered device public key",
      };
    }

    try {
      const valid = nacl.sign.detached.verify(signTarget, signature, publicKey);

      if (!valid) {
        return { valid: false, error: "Device signature verification failed" };
      }

      return {
        valid: true,
        actorId: deviceSE.deviceId,
        metadata: { deviceId: deviceSE.deviceId, proofType: "DEVICE_SE" },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return {
        valid: false,
        error: `Signature verification error: ${message}`,
      };
    }
  }

  registerDeviceKey(deviceId: string, publicKey: Uint8Array): void {
    if (publicKey.length !== 32) {
      throw new Error("Device public key must be 32 bytes (Ed25519)");
    }
    this.deviceKeys.set(deviceId, publicKey);
    this.logger.log(`Registered device key for ${deviceId}`);
  }

  unregisterDevice(deviceId: string): boolean {
    return this.deviceKeys.delete(deviceId);
  }

  registerMTLSCert(fingerprint: string, actorId: string): void {
    this.trustedCerts.set(fingerprint, { actorId, issuedAt: Date.now() });
    this.logger.log(`Registered mTLS cert ${fingerprint} for actor ${actorId}`);
  }

  revokeMTLSCert(fingerprint: string): boolean {
    return this.trustedCerts.delete(fingerprint);
  }

  static calculateFingerprint(certPem: string): string {
    const der = Buffer.from(
      certPem
        .replace(/-----BEGIN CERTIFICATE-----/, "")
        .replace(/-----END CERTIFICATE-----/, "")
        .replace(/\s/g, ""),
      "base64",
    );
    return crypto.createHash("sha256").update(der).digest("hex");
  }
}
