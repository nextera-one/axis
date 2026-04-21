import 'reflect-metadata';

import type { AxisIntentSensorRef } from './intent.decorator';

export const INTENT_SENSORS_KEY = 'axis:intent:sensors';

/**
 * @IntentSensors — Attach additional sensors that must pass before the
 * annotated intent handler executes.
 */
export function IntentSensors(sensors: AxisIntentSensorRef[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(INTENT_SENSORS_KEY, sensors, target, propertyKey);
  };
}
