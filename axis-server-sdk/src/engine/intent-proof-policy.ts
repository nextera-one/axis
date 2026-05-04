import "reflect-metadata";

import {
  AXIS_ANONYMOUS_KEY,
  AXIS_AUTHORIZED_KEY,
  AXIS_PUBLIC_KEY,
  REQUIRED_PROOF_METADATA_KEY,
  type RequiredProofKind,
} from "../decorators/intent-policy.decorator";

/**
 * Effective proof policy after class-level defaults and method-level overrides
 * have been resolved for one intent.
 */
export interface IntentProofPolicy {
  requiredProof: RequiredProofKind[];
  isPublic: boolean;
  isAnonymous: boolean;
  isAuthorized: boolean;
}

function mergeProofKinds(
  ...proofGroups: Array<RequiredProofKind[] | undefined>
): RequiredProofKind[] {
  const merged = new Set<RequiredProofKind>();
  for (const proofs of proofGroups) {
    for (const proof of proofs ?? []) {
      merged.add(proof);
    }
  }
  return Array.from(merged);
}

/**
 * Access decorators are proof-policy shorthands:
 * - @AxisPublic()     -> NONE
 * - @AxisAnonymous()  -> ANONYMOUS
 * - @AxisAuthorized() -> AUTHORIZED
 */
function accessProofKinds(
  isPublic?: boolean,
  isAnonymous?: boolean,
  isAuthorized?: boolean,
): RequiredProofKind[] {
  const proofs: RequiredProofKind[] = [];
  if (isPublic) proofs.push("NONE");
  if (isAnonymous) proofs.push("ANONYMOUS");
  if (isAuthorized) proofs.push("AUTHORIZED");
  return proofs;
}

/**
 * Resolves the proof policy for a single handler method.
 *
 * Precedence rule:
 * method-level policy wins over class-level policy. This allows handlers to
 * declare a class default such as `@RequiredProof(['NONE'])` and override one
 * method with `@AxisAuthorized()` or `@RequiredProof(['AUTHORIZED'])`.
 */
export function resolveIntentProofPolicy(
  proto: object,
  methodName: string,
): IntentProofPolicy {
  const methodProof: RequiredProofKind[] | undefined = Reflect.getMetadata(
    REQUIRED_PROOF_METADATA_KEY,
    proto,
    methodName,
  );
  const classProof: RequiredProofKind[] | undefined = Reflect.getMetadata(
    REQUIRED_PROOF_METADATA_KEY,
    proto.constructor,
  );
  const isPublicMethod: boolean | undefined = Reflect.getMetadata(
    AXIS_PUBLIC_KEY,
    proto,
    methodName,
  );
  const isPublicClass: boolean | undefined = Reflect.getMetadata(
    AXIS_PUBLIC_KEY,
    proto.constructor,
  );
  const isAnonymousMethod: boolean | undefined = Reflect.getMetadata(
    AXIS_ANONYMOUS_KEY,
    proto,
    methodName,
  );
  const isAnonymousClass: boolean | undefined = Reflect.getMetadata(
    AXIS_ANONYMOUS_KEY,
    proto.constructor,
  );
  const isAuthorizedMethod: boolean | undefined = Reflect.getMetadata(
    AXIS_AUTHORIZED_KEY,
    proto,
    methodName,
  );
  const isAuthorizedClass: boolean | undefined = Reflect.getMetadata(
    AXIS_AUTHORIZED_KEY,
    proto.constructor,
  );

  const methodPolicyProof = mergeProofKinds(
    methodProof,
    accessProofKinds(isPublicMethod, isAnonymousMethod, isAuthorizedMethod),
  );
  const classPolicyProof = mergeProofKinds(
    classProof,
    accessProofKinds(isPublicClass, isAnonymousClass, isAuthorizedClass),
  );
  const requiredProof = methodPolicyProof.length
    ? methodPolicyProof
    : classPolicyProof;

  return {
    requiredProof,
    isPublic: requiredProof.includes("NONE"),
    isAnonymous: requiredProof.includes("ANONYMOUS"),
    isAuthorized: requiredProof.includes("AUTHORIZED"),
  };
}
