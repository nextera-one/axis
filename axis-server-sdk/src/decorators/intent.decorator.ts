import 'reflect-metadata';

import type { ChainOptions } from '../engine/axis-chain.types';

export const INTENT_METADATA_KEY = 'axis:intent';
export const INTENT_ROUTES_KEY = 'axis:intent_routes';

/**
 * CRUD + action classification for an intent.
 */
export type IntentKind = 'create' | 'read' | 'update' | 'delete' | 'action';

/**
 * A sensor reference declared on an intent.
 * - `string`: resolved from SensorRegistry by sensor name
 * - `Function`: resolved from SensorRegistry by provider class, with DI fallback
 */
export type AxisIntentSensorRef = string | Function;

/**
 * Shared options for attaching intent-specific sensors.
 * Kept separate so other decorators / route metadata can extend it cleanly.
 */
export interface AxisIntentSensorOptions {
  /** Intent-specific sensors resolved before the handler executes */
  is?: AxisIntentSensorRef[];
}

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

export interface IntentRoute extends AxisIntentSensorOptions {
  action: string;
  methodName: string | symbol;
  absolute?: boolean;
  frame?: boolean;
  kind?: IntentKind;
  chain?: boolean | ChainOptions;
  bodyProfile?: 'TLV_MAP' | 'RAW' | 'TLV_OBJ' | 'TLV_ARR';
  tlv?: IntentTlvField[];
  dto?: Function;
}

export interface IntentOptions extends AxisIntentSensorOptions {
  /** Operation classification for this intent */
  kind?: IntentKind;
  /** If true, the action is the full intent name (not prefixed with handler name) */
  absolute?: boolean;
  /** If true, register as { handle: fn } for frame-based handlers */
  frame?: boolean;
  /** Enables intent-chain semantics for this intent, optionally with chain defaults */
  chain?: boolean | ChainOptions;
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
      chain: options?.chain,
      bodyProfile: options?.bodyProfile,
      tlv: options?.tlv,
      dto: options?.dto,
      is: options?.is,
    });
    Reflect.defineMetadata(INTENT_ROUTES_KEY, routes, target.constructor);
  };
}
