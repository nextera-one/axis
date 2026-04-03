import { SetMetadata } from '@nestjs/common';

export const SENSOR_METADATA_KEY = 'axis:sensor';

export type SensorPhase = 'PRE_DECODE' | 'POST_DECODE';

export interface SensorOptions {
  /** Explicit phase override. If omitted, auto-derived from order at bootstrap. */
  phase?: SensorPhase;
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
 *
 * @example
 * ```typescript
 * @Sensor({ phase: 'PRE_DECODE' })
 * @Injectable()
 * export class WireSensor implements AxisSensor {
 *   readonly name = 'WireSensor';
 *   readonly order = BAND.WIRE + 10;
 * }
 *
 * @Sensor() // phase auto-derived as POST_DECODE
 * @Injectable()
 * export class PolicySensor implements AxisSensor {
 *   readonly name = 'PolicySensor';
 *   readonly order = BAND.POLICY + 10;
 * }
 * ```
 */
export function Sensor(options?: SensorOptions): ClassDecorator {
  return SetMetadata(SENSOR_METADATA_KEY, options ?? true);
}
