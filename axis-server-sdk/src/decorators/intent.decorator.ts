import 'reflect-metadata';

export const INTENT_ROUTES_KEY = 'axis:intent_routes';

export interface IntentRoute {
  action: string;
  methodName: string | symbol;
  absolute?: boolean;
  frame?: boolean;
}

export interface IntentOptions {
  /** If true, the action is the full intent name (not prefixed with handler name) */
  absolute?: boolean;
  /** If true, register as { handle: fn } for frame-based handlers */
  frame?: boolean;
}

/**
 * Marks a method as an intent handler.
 *
 * The full intent name is resolved as `{handler_prefix}.{action}` by default.
 * Use `{ absolute: true }` to use the action string as the full intent name.
 * Use `{ frame: true }` for handlers that receive an AxisFrame and return AxisEffect.
 *
 * @example
 * ```ts
 * @Handler('axis.actor_keys')
 * class MyHandler {
 *   @Intent('create')
 *   async create(body: Uint8Array) { ... }
 *
 *   @Intent('public.auth.capsule.issue', { absolute: true })
 *   async publicIssue(body: Uint8Array) { ... }
 *
 *   @Intent('presence.resume', { frame: true })
 *   async handlePresence(frame: AxisFrame) { ... }
 * }
 * ```
 */
export function Intent(action: string, options?: IntentOptions): MethodDecorator {
  return (target, propertyKey) => {
    const routes: IntentRoute[] =
      Reflect.getMetadata(INTENT_ROUTES_KEY, target.constructor) || [];
    routes.push({
      action,
      methodName: propertyKey,
      absolute: options?.absolute,
      frame: options?.frame,
    });
    Reflect.defineMetadata(INTENT_ROUTES_KEY, routes, target.constructor);
  };
}
