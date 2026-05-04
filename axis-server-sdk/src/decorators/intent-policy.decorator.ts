import "reflect-metadata";

import type { ExecutionContract } from "../contract/contract.interface";
import type { ProofKind, SensitivityLevel } from "../schemas/axis-schemas";

// ─── Metadata Keys ────────────────────────────────────────────────────────────

/** Metadata key stamped by @Axis on the protocol entry class. */
export const AXIS_META_KEY = "axis:axis";

export const SENSITIVITY_METADATA_KEY = "axis:sensitivity";
export const CONTRACT_METADATA_KEY = "axis:contract";
export const REQUIRED_PROOF_METADATA_KEY = "axis:required_proof";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Extends ProofKind with WITNESS — requires a co-signer witness signature
 * in addition to the standard proof kinds (CAPSULE, PASSPORT, MTLS, JWT).
 */
export type RequiredProofKind = ProofKind;

function appendRequiredProof(
  target: object | Function,
  propertyKey: string | symbol | undefined,
  proof: RequiredProofKind,
): void {
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

  const merged: RequiredProofKind[] = existing.includes(proof)
    ? existing
    : [...existing, proof];

  if (propertyKey !== undefined) {
    Reflect.defineMetadata(
      REQUIRED_PROOF_METADATA_KEY,
      merged,
      target,
      propertyKey,
    );
    return;
  }

  Reflect.defineMetadata(
    REQUIRED_PROOF_METADATA_KEY,
    merged,
    target as Function,
  );
}

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
    appendRequiredProof(target, propertyKey, "CAPSULE");
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
    appendRequiredProof(target, propertyKey, "WITNESS");
  }) as ClassDecorator & MethodDecorator;
}

// ─── @Axis ───────────────────────────────────────────────────────────────────

/**
 * @Axis — AXIS protocol entry point decorator.
 *
 * Marks a class as the single binary pipeline entry. The decorated class
 * is auto-discovered by `AxisEngineModule` and wired to `POST /axis`.
 * There must be exactly ONE `@Axis()` class in the application.
 *
 * @example
 * ```typescript
 * @Axis()
 * @Injectable()
 * export class AxisEntry implements NestMiddleware { ... }
 * ```
 */
export function Axis(): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(AXIS_META_KEY, { entry: true }, target);
  };
}

// ─── @AxisPublic ──────────────────────────────────────────────────────────────

/**
 * Metadata key stamped on a class or method to mark it as public.
 * Read by HandlerDiscoveryService and injected into SensorInput.metadata.isPublic.
 */
export const AXIS_PUBLIC_KEY = "axis:public";

/**
 * @AxisPublic — Marks a handler class or individual intent method as public.
 *
 * Public intents bypass signature verification and authentication sensors.
 * Use for discovery/catalog endpoints, health checks, and registration flows.
 *
 * Applied at class level → all intents in the handler are public.
 * Applied at method level → only that intent is public.
 *
 * @example
 * ```typescript
 * @AxisPublic()
 * @Handler('catalog')
 * export class CatalogHandler { ... }
 *
 * // Single public intent inside an authenticated handler:
 * @Handler('axis.auth')
 * export class AuthHandler {
 *   @AxisPublic()
 *   @Intent('axis.auth.register', { absolute: true, kind: 'action' })
 *   async register(...) { ... }
 * }
 * ```
 */
export function AxisPublic(): ClassDecorator & MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(AXIS_PUBLIC_KEY, true, target, propertyKey!);
      appendRequiredProof(target, propertyKey, "NONE");
      return descriptor;
    }
    Reflect.defineMetadata(AXIS_PUBLIC_KEY, true, target);
    appendRequiredProof(target, undefined, "NONE");
    return target;
  };
}

// ─── @AxisAnonymous ───────────────────────────────────────────────────────────

/**
 * Metadata key stamped on a class or method to mark it as anonymous-accessible.
 * Anonymous intents can be called with an anonymous-session capsule.
 * Read by HandlerDiscoveryService and injected into SensorInput.metadata.isAnonymous.
 */
export const AXIS_ANONYMOUS_KEY = "axis:anonymous";

// ─── @AxisAuthorized ──────────────────────────────────────────────────────────

export const AXIS_AUTHORIZED_KEY = "axis:authorized";

export function AxisAuthorized(): ClassDecorator & MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(AXIS_AUTHORIZED_KEY, true, target, propertyKey!);
      appendRequiredProof(target, propertyKey, "AUTHORIZED");
      return descriptor;
    }
    Reflect.defineMetadata(AXIS_AUTHORIZED_KEY, true, target);
    appendRequiredProof(target, undefined, "AUTHORIZED");
    return target;
  };
}
/**
 * @AxisAnonymous — Marks a handler class or individual intent method as
 * accessible to anonymous sessions.
 *
 * Anonymous intents require an anonymous-session capsule (issued via
 * `public.session.anonymous`) but do NOT require full actor authentication.
 * A step above `@AxisPublic` (which needs no capsule at all).
 *
 * Applied at class level → all intents in the handler are anonymous-accessible.
 * Applied at method level → only that intent is anonymous-accessible.
 *
 * @example
 * ```typescript
 * @Handler('catalog')
 * export class CatalogHandler {
 *   @AxisAnonymous()
 *   @Intent('catalog.list', { absolute: true, kind: 'read' })
 *   async list(body: Uint8Array) { ... }
 * }
 * ```
 */
export function AxisAnonymous(): ClassDecorator & MethodDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (propertyKey !== undefined) {
      Reflect.defineMetadata(AXIS_ANONYMOUS_KEY, true, target, propertyKey!);
      appendRequiredProof(target, propertyKey, "ANONYMOUS");
      return descriptor;
    }
    Reflect.defineMetadata(AXIS_ANONYMOUS_KEY, true, target);
    appendRequiredProof(target, undefined, "ANONYMOUS");
    return target;
  };
}

// ─── @AxisRateLimit ───────────────────────────────────────────────────────────

/**
 * Metadata key for per-intent rate limit config.
 * Stamped on a method by @AxisRateLimit.
 * Read by HandlerDiscoveryService and consumed by RateLimitSensor at runtime.
 */
export const AXIS_RATE_LIMIT_KEY = "axis:rateLimit";

export interface AxisRateLimitConfig {
  /** Maximum requests allowed within the window. */
  max: number;
  /** Sliding window duration in seconds. */
  windowSec: number;
  /**
   * Key strategy or named bucket.
   * e.g. 'ip_fingerprint' | 'actor_capsule' | 'auth' | 'qr-scan'
   */
  key?: string;
}

/**
 * @AxisRateLimit — Per-intent rate limit configuration.
 *
 * Overrides the handler-level or global default rate limit for a single intent.
 * The config is read by HandlerDiscoveryService and injected into
 * SensorInput.metadata.rateLimit, consumed by RateLimitSensor at runtime.
 *
 * @example
 * ```typescript
 * @AxisRateLimit({ max: 5, windowSec: 60, key: 'ip_fingerprint' })
 * @Intent('axis.auth.login', { absolute: true, kind: 'action' })
 * async login(body: Uint8Array) { ... }
 * ```
 */
export function AxisRateLimit(config: AxisRateLimitConfig): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(AXIS_RATE_LIMIT_KEY, config, target, propertyKey);
    return descriptor;
  };
}
