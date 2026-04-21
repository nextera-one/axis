import "reflect-metadata";

import type { AxisIntentSensorRef } from "./intent.decorator";

export const HANDLER_SENSORS_KEY = "axis:handler:sensors";

/**
 * @HandlerSensors — Attach sensors that must pass before ANY intent in this
 * handler class executes.  Per-intent @IntentSensors still run after these.
 *
 * @example
 * ```ts
 * @Handler('axis.vault')
 * @HandlerSensors([RateLimitSensor, AuditSensor])
 * export class VaultHandler {
 *   @Intent('create')
 *   async create(body: Uint8Array) { ... }
 *
 *   @Intent('delete')
 *   @IntentSensors([MfaSensor])   // Runs AFTER handler-level sensors
 *   async delete(body: Uint8Array) { ... }
 * }
 * ```
 */
export function HandlerSensors(sensors: AxisIntentSensorRef[]): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(HANDLER_SENSORS_KEY, sensors, target);
  };
}
