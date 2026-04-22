import { Injectable } from "@nestjs/common";
import {
  Handler as CoreHandler,
  HANDLER_METADATA_KEY,
} from "@nextera.one/axis-server-sdk";

export { HANDLER_METADATA_KEY };

/**
 * Decorator to mark a class as an Axis Handler.
 * Handlers are responsible for processing intents or specific logic
 * for Axis modules.
 */
export function Handler(intent?: string): ClassDecorator {
  const applyCore = CoreHandler(intent);
  const applyInjectable = Injectable();
  return (target: Function) => {
    applyCore(target);
    applyInjectable(target as any);
  };
}
