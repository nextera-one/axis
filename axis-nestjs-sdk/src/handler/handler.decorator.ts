import { Injectable } from "@nestjs/common";
import {
  Handler as CoreHandler,
  HANDLER_METADATA_KEY,
  type AxisIntentSensorOptions,
  type AxisObserverBindingInput,
} from "@nextera.one/axis-server-sdk";

export { HANDLER_METADATA_KEY };
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
  const applyCore = (CoreHandler as any)(intentOrOptions, options);
  const applyInjectable = Injectable();
  return (target: Function) => {
    applyCore(target);
    applyInjectable(target as any);
  };
}
