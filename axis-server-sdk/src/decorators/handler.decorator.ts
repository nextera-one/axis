import "reflect-metadata";

import { HANDLER_SENSORS_KEY } from "./handler-sensors.decorator";
import {
  OBSERVER_BINDINGS_KEY,
  type AxisObserverBinding,
  type AxisObserverBindingInput,
  toObserverBinding,
} from "./observer.decorator";
import {
  type AxisIntentSensorOptions,
  type AxisIntentSensorBindingInput,
  toIntentSensorBinding,
} from "./intent.decorator";

export const HANDLER_METADATA_KEY = "axis:handler";

export interface HandlerOptions extends AxisIntentSensorOptions {
  observe?: AxisObserverBindingInput[];
}

/**
 * Decorator to mark a class as an Axis Handler.
 * Handlers are responsible for processing intents or specific logic
 * for Axis modules.
 */
export function Handler(
  intentOrOptions?: string | HandlerOptions,
  options?: HandlerOptions,
): ClassDecorator {
  return (target: Function) => {
    const intent =
      typeof intentOrOptions === "string" ? intentOrOptions : undefined;
    const handlerOptions =
      typeof intentOrOptions === "string" ? options : intentOrOptions;
    const sensorBindings = Array.isArray(handlerOptions?.is)
      ? handlerOptions.is.map((input: AxisIntentSensorBindingInput) =>
          toIntentSensorBinding(input),
        )
      : [];
    const observerBindings: AxisObserverBinding[] = Array.isArray(
      handlerOptions?.observe,
    )
      ? handlerOptions.observe
          .map((input) => toObserverBinding(input))
          .filter((binding): binding is AxisObserverBinding => !!binding)
      : [];

    Reflect.defineMetadata(
      HANDLER_METADATA_KEY,
      { intent, ...(handlerOptions || {}) },
      target,
    );

    if (sensorBindings.length > 0) {
      const existing =
        Reflect.getMetadata(HANDLER_SENSORS_KEY, target) || [];
      Reflect.defineMetadata(
        HANDLER_SENSORS_KEY,
        [...existing, ...sensorBindings],
        target,
      );
    }

    if (observerBindings.length > 0) {
      const existing: AxisObserverBinding[] =
        Reflect.getMetadata(OBSERVER_BINDINGS_KEY, target) || [];
      Reflect.defineMetadata(
        OBSERVER_BINDINGS_KEY,
        [...existing, ...observerBindings],
        target,
      );
    }
  };
}
