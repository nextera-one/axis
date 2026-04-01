import 'reflect-metadata';

export const INTENT_METADATA_KEY = 'axis:intent';
export const INTENT_ROUTES_KEY = 'axis:intent_routes';

/**
 * CRUD + action classification for an intent.
 */
export type IntentKind = 'create' | 'read' | 'update' | 'delete' | 'action';

/**
 * Describes a single TLV field expected by an intent.
 * Used by SchemaValidationSensor to enforce field contracts.
 */
export interface IntentTlvField {
  /** Human-readable field name (used in error messages) */
  name: string;
  /** TLV tag number */
  tag: number;
  /** Value type for type-specific validation */
  kind: 'utf8' | 'u64' | 'bytes' | 'bytes16' | 'bool' | 'obj' | 'arr';
  /** If true, sensor denies when this tag is missing */
  required?: boolean;
  /** Maximum byte length of the value */
  maxLen?: number;
  /** Maximum numeric value (string for bigint-safe limits) */
  max?: string;
  /** Which frame section contains this field (default: 'body') */
  scope?: 'header' | 'body';
}

export interface IntentRoute {
  action: string;
  methodName: string | symbol;
  absolute?: boolean;
  frame?: boolean;
  kind?: IntentKind;
  bodyProfile?: 'TLV_MAP' | 'RAW' | 'TLV_OBJ' | 'TLV_ARR';
  tlv?: IntentTlvField[];
  dto?: Function;
}

export interface IntentOptions {
  /** Operation classification for this intent */
  kind?: IntentKind;
  /** If true, the action is the full intent name (not prefixed with handler name) */
  absolute?: boolean;
  /** If true, register as { handle: fn } for frame-based handlers */
  frame?: boolean;
  /**
   * How the body is encoded. Drives TLVParseSensor behavior:
   * - `TLV_MAP`  — flat TLV map (canonical ordering enforced)
   * - `RAW`      — raw bytes, skip TLV body validation
   * - `TLV_OBJ`  — nested TLV object
   * - `TLV_ARR`  — TLV array container
   */
  bodyProfile?: 'TLV_MAP' | 'RAW' | 'TLV_OBJ' | 'TLV_ARR';
  /** Inline TLV field definitions for schema validation */
  tlv?: IntentTlvField[];
  /** DTO class decorated with @TlvField for schema extraction */
  dto?: Function;
}

/**
 * Marks a method as an intent handler.
 *
 * Stores both per-method metadata (INTENT_METADATA_KEY) and
 * route-collection metadata (INTENT_ROUTES_KEY) for backward compatibility.
 *
 * @example
 * ```ts
 * @Handler('axis.actor_keys')
 * class MyHandler {
 *   @Intent('create', { kind: 'create', dto: CreateDto })
 *   async create(body: Uint8Array) { ... }
 *
 *   @Intent('axis.auth.login', { absolute: true, kind: 'action', dto: LoginDto })
 *   async login(body: Uint8Array) { ... }
 * }
 * ```
 */
export function Intent(
  action: string,
  options?: IntentOptions,
): MethodDecorator {
  return (target, propertyKey) => {
    // Per-method metadata (backend-style)
    Reflect.defineMetadata(
      INTENT_METADATA_KEY,
      { intent: action, ...options },
      target,
      propertyKey,
    );

    // Route-collection metadata (SDK-style, backward compat)
    const routes: IntentRoute[] =
      Reflect.getMetadata(INTENT_ROUTES_KEY, target.constructor) || [];
    routes.push({
      action,
      methodName: propertyKey,
      absolute: options?.absolute,
      frame: options?.frame,
      kind: options?.kind,
      bodyProfile: options?.bodyProfile,
      tlv: options?.tlv,
      dto: options?.dto,
    });
    Reflect.defineMetadata(INTENT_ROUTES_KEY, routes, target.constructor);
  };
}
