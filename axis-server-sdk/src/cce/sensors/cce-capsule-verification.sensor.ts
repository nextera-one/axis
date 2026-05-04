/**
 * CCE Capsule Verification Sensor
 *
 * Band: IDENTITY (order: 50)
 * Phase: POST_DECODE
 *
 * Step 6 from CCE verification order:
 * 6. Parse capsule, verify TickAuth signature, verify integrity
 */
import type {
  AxisSensor,
  SensorDecision,
  SensorInput,
} from "../../sensor/axis-sensor";
import { Decision } from "../../sensor/axis-sensor";
import {
  CCE_ERROR,
  CCE_PROTOCOL_VERSION,
  type CceCapsuleClaims,
} from "../cce.types";

/**
 * TickAuth issuer key resolver.
 */
export interface CceIssuerKeyResolver {
  resolve(kid: string): Promise<{ publicKeyHex: string } | null>;
}

/**
 * Signature verifier for capsule issuer signatures.
 */
export interface CceCapsuleSignatureVerifier {
  verify(
    claims: Omit<CceCapsuleClaims, "issuer_sig">,
    signature: { alg: string; kid: string; value: string },
    publicKeyHex: string,
  ): Promise<boolean>;
}

export class CceCapsuleVerificationSensor implements AxisSensor {
  readonly name = "cce.capsule.verification";
  readonly order = 50;
  readonly phase = "POST_DECODE" as const;

  constructor(
    private readonly issuerKeyResolver: CceIssuerKeyResolver,
    private readonly capsuleVerifier: CceCapsuleSignatureVerifier,
  ) {}

  // supports() is a synchronous applicability gate.
  // Return false to skip this sensor without producing a denial.
  supports(input: SensorInput): boolean {
    return input.metadata?.cceEnvelopeValid === true;
  }

  // run() executes only after supports() passes.
  // Return the actual ALLOW/DENY/FLAG/THROTTLE decision here.
  async run(input: SensorInput): Promise<SensorDecision> {
    const capsule = input.metadata?.cceEnvelope?.capsule as
      | CceCapsuleClaims
      | undefined;

    if (!capsule) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.MISSING_CAPSULE],
        code: CCE_ERROR.MISSING_CAPSULE,
      };
    }

    // Verify protocol version
    if (capsule.ver !== CCE_PROTOCOL_VERSION) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [
          `${CCE_ERROR.CAPSULE_SIG_INVALID}: wrong version ${capsule.ver}`,
        ],
        code: CCE_ERROR.CAPSULE_SIG_INVALID,
      };
    }

    // Verify content integrity (ID matches hash)
    const { capsule_id, issuer_sig, ...claimsBody } = capsule;
    const expectedId = computeCceCapsuleId(claimsBody);
    if (capsule_id !== expectedId) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.CAPSULE_SIG_INVALID}: content hash mismatch`],
        code: CCE_ERROR.CAPSULE_SIG_INVALID,
      };
    }

    // Resolve TickAuth issuer key
    const issuerKey = await this.issuerKeyResolver.resolve(
      capsule.issuer_sig.kid,
    );
    if (!issuerKey) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.CAPSULE_SIG_INVALID}: issuer key not found`],
        code: CCE_ERROR.CAPSULE_SIG_INVALID,
      };
    }

    // Verify issuer signature
    const { issuer_sig: sig, ...rest } = capsule;
    const sigValid = await this.capsuleVerifier.verify(
      rest,
      sig,
      issuerKey.publicKeyHex,
    );
    if (!sigValid) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [CCE_ERROR.CAPSULE_SIG_INVALID],
        code: CCE_ERROR.CAPSULE_SIG_INVALID,
      };
    }

    // Check expiry
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (capsule.exp < nowSeconds) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.CAPSULE_EXPIRED}: exp=${capsule.exp}`],
        code: CCE_ERROR.CAPSULE_EXPIRED,
      };
    }

    // Check not-yet-valid (iat in future with tolerance)
    if (capsule.iat > nowSeconds + 5) {
      return {
        allow: false,
        riskScore: 100,
        reasons: [`${CCE_ERROR.CAPSULE_NOT_YET_VALID}: iat=${capsule.iat}`],
        code: CCE_ERROR.CAPSULE_NOT_YET_VALID,
      };
    }

    // Store verified capsule for downstream
    input.metadata = input.metadata ?? {};
    input.metadata.cceCapsuleVerified = true;
    input.metadata.cceCapsule = capsule;

    return {
      decision: Decision.ALLOW,
      allow: true,
      riskScore: 0,
      reasons: [],
      meta: { capsule_id: capsule.capsule_id },
    };
  }
}

// Content-addressed capsule ID computation
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";

function canonicalize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }
  if (obj !== null && typeof obj === "object") {
    const sorted = Object.keys(obj as object)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalize((obj as Record<string, unknown>)[k]),
      );
    return "{" + sorted.join(",") + "}";
  }
  return JSON.stringify(obj);
}

function computeCceCapsuleId(claims: Record<string, unknown>): string {
  const canonical = canonicalize(claims);
  const hash = blake3(new TextEncoder().encode(canonical));
  return "cce_b3_" + bytesToHex(hash).slice(0, 32);
}
