import "reflect-metadata";

import { RequiredProofKind } from "./intent-policy.decorator";

export const SENSOR_METADATA_KEY = "axis:sensor";

export type SensorPhase = "PRE_DECODE" | "POST_DECODE";

export interface SensorOptions {
  /** Explicit phase override. If omitted, auto-derived from order at bootstrap. */
  phase?: SensorPhase;
  proofKind?: RequiredProofKind;
}

/**
 * Marks a class as an AXIS sensor for auto-registration.
 *
 * The SensorDiscoveryService finds all @Sensor() classes at bootstrap
 * and registers them with the SensorRegistry automatically.
 *
 * Sensors still declare `name`, `order`, `supports()`, and `run()` as
 * instance members. The decorator replaces manual `registry.register(this)`
 * in `onModuleInit()`.
 *
 * Phase can be set explicitly via options or auto-derived from order:
 * < PRE_DECODE_BOUNDARY (40) = PRE_DECODE, >= 40 = POST_DECODE.
 */
export function Sensor(options?: SensorOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SENSOR_METADATA_KEY, options ?? true, target);
  };
}
