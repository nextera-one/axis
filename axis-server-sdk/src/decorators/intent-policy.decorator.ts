import "reflect-metadata";

import type { ExecutionContract } from "../contract/contract.interface";
import type { ProofKind, SensitivityLevel } from "../schemas/axis-schemas";

// ─── Metadata Keys ────────────────────────────────────────────────────────────

export const SENSITIVITY_METADATA_KEY = "axis:sensitivity";
export const CONTRACT_METADATA_KEY = "axis:contract";
export const REQUIRED_PROOF_METADATA_KEY = "axis:required_proof";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Extends ProofKind with WITNESS — requires a co-signer witness signature
 * in addition to the standard proof kinds (CAPSULE, PASSPORT, MTLS, JWT).
 */
export type RequiredProofKind = ProofKind | "WITNESS";

// ─── @Sensitivity ─────────────────────────────────────────────────────────────

/**
 * Declares the sensitivity tier of an intent.
 *
 * Used by risk gates and audit trails to apply appropriate scrutiny.
 *
 * @example
 * ```ts
 * @Sensitivity('CRITICAL')
 * @Intent('axis.actor_keys.list')
 * async list() { ... }
 * ```
 */
export function Sensitivity(
  level: SensitivityLevel,
): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        SENSITIVITY_METADATA_KEY,
        level,
        target,
        propertyKey,
      );
      return;
    }
    Reflect.defineMetadata(SENSITIVITY_METADATA_KEY, level, target as Function);
  }) as ClassDecorator & MethodDecorator;
}

// ─── @Contract ────────────────────────────────────────────────────────────────

/**
 * Declares the execution contract (resource ceiling) for an intent.
 *
 * The execution meter enforces these limits at runtime. Unspecified fields
 * fall back to handler-level or global defaults.
 *
 * @example
 * ```ts
 * @Contract({ maxDbWrites: 5, maxTimeMs: 300 })
 * @Intent('axis.actor_keys.list')
 * async list() { ... }
 * ```
 */
export function Contract(
  options: Partial<ExecutionContract>,
): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        CONTRACT_METADATA_KEY,
        options,
        target,
        propertyKey,
      );
      return;
    }
    Reflect.defineMetadata(CONTRACT_METADATA_KEY, options, target as Function);
  }) as ClassDecorator & MethodDecorator;
}

// ─── @RequiredProof ───────────────────────────────────────────────────────────

/**
 * Specifies which proof kinds are accepted to satisfy this intent.
 * At least one of the listed kinds must be present in the request.
 *
 * Use `@Capsule()` or `@Witness()` as ergonomic shorthands for the
 * single-proof case.
 *
 * @example
 * ```ts
 * @RequiredProof(['CAPSULE', 'WITNESS'])
 * @Intent('axis.actor_keys.list')
 * async list() { ... }
 * ```
 */
export function RequiredProof(
  proofs: [RequiredProofKind, ...RequiredProofKind[]],
): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        REQUIRED_PROOF_METADATA_KEY,
        proofs,
        target,
        propertyKey,
      );
      return;
    }
    Reflect.defineMetadata(
      REQUIRED_PROOF_METADATA_KEY,
      proofs,
      target as Function,
    );
  }) as ClassDecorator & MethodDecorator;
}

// ─── @Capsule ─────────────────────────────────────────────────────────────────

/**
 * Shorthand for `@RequiredProof(['CAPSULE'])`.
 *
 * Merges with any proof kinds already declared on the target so that
 * combining `@Capsule()` with `@Witness()` behaves identically to
 * `@RequiredProof(['CAPSULE', 'WITNESS'])`.
 *
 * @example
 * ```ts
 * @Capsule()
 * @Intent('axis.actor_keys.get')
 * async get() { ... }
 * ```
 */
export function Capsule(): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    const existing: RequiredProofKind[] =
      propertyKey !== undefined
        ? (Reflect.getMetadata(
            REQUIRED_PROOF_METADATA_KEY,
            target,
            propertyKey,
          ) ?? [])
        : (Reflect.getMetadata(
            REQUIRED_PROOF_METADATA_KEY,
            target as Function,
          ) ?? []);

    const merged: RequiredProofKind[] = existing.includes("CAPSULE")
      ? existing
      : [...existing, "CAPSULE"];

    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        REQUIRED_PROOF_METADATA_KEY,
        merged,
        target,
        propertyKey,
      );
    } else {
      Reflect.defineMetadata(
        REQUIRED_PROOF_METADATA_KEY,
        merged,
        target as Function,
      );
    }
  }) as ClassDecorator & MethodDecorator;
}

// ─── @Witness ─────────────────────────────────────────────────────────────────

/**
 * Shorthand for `@RequiredProof(['WITNESS'])`.
 *
 * Declares that the intent requires a co-signer witness signature
 * (maps to `ProofType.WITNESS_SIG` at the protocol layer).
 *
 * Merges with any proof kinds already declared on the target, so
 * `@Capsule()` + `@Witness()` is equivalent to
 * `@RequiredProof(['CAPSULE', 'WITNESS'])`.
 *
 * @example
 * ```ts
 * @Witness()
 * @Sensitivity('CRITICAL')
 * @Intent('axis.actor_keys.list')
 * async list() { ... }
 * ```
 */
export function Witness(): ClassDecorator & MethodDecorator {
  return ((target: object | Function, propertyKey?: string | symbol) => {
    const existing: RequiredProofKind[] =
      propertyKey !== undefined
        ? (Reflect.getMetadata(
            REQUIRED_PROOF_METADATA_KEY,
            target,
            propertyKey,
          ) ?? [])
        : (Reflect.getMetadata(
            REQUIRED_PROOF_METADATA_KEY,
            target as Function,
          ) ?? []);

    const merged: RequiredProofKind[] = existing.includes("WITNESS")
      ? existing
      : [...existing, "WITNESS"];

    if (propertyKey !== undefined) {
      Reflect.defineMetadata(
        REQUIRED_PROOF_METADATA_KEY,
        merged,
        target,
        propertyKey,
      );
    } else {
      Reflect.defineMetadata(
        REQUIRED_PROOF_METADATA_KEY,
        merged,
        target as Function,
      );
    }
  }) as ClassDecorator & MethodDecorator;
}
