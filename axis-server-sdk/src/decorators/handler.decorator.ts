import "reflect-metadata";

export const HANDLER_METADATA_KEY = "axis:handler";

/**
 * Decorator to mark a class as an Axis Handler.
 * Handlers are responsible for processing intents or specific logic
 * for Axis modules.
 */
export function Handler(intent?: string): ClassDecorator {
  return (target: Function) => {
    Reflect.defineMetadata(HANDLER_METADATA_KEY, { intent }, target);
  };
}
