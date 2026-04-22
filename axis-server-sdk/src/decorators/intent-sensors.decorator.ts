import 'reflect-metadata';

import type { AxisIntentSensorBindingInput } from './intent.decorator';

export const INTENT_SENSORS_KEY = 'axis:intent:sensors';

/**
 * @IntentSensors — Attach additional sensors that must pass before the
 * annotated intent handler executes.
 */
export function IntentSensors(
  sensors: AxisIntentSensorBindingInput[],
): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(INTENT_SENSORS_KEY, sensors, target, propertyKey);
  };
}
