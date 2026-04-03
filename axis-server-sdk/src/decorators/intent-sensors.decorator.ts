import 'reflect-metadata';

export const INTENT_SENSORS_KEY = 'axis:intent:sensors';

/**
 * @IntentSensors — Attach additional sensors that must pass before the
 * annotated intent handler executes.
 */
export function IntentSensors(sensors: Function[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(INTENT_SENSORS_KEY, sensors, target, propertyKey);
  };
}
