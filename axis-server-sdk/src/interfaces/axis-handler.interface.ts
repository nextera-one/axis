/**
 * Base interface for AXIS Intent Handlers.
 * Handlers are responsible for processing specific intents routed by the IntentRouter.
 */
export interface AxisHandler {
  readonly name: string;
  readonly open?: boolean;
  readonly description?: string;
  readonly execute?: (
    body: Uint8Array,
    headers?: Map<number, Uint8Array>,
  ) => Promise<Uint8Array | any>;
}

/**
 * Handler that initializes itself by registering its intents with the IntentRouter.
 * This is the standard pattern for most AXIS handlers.
 */
export interface AxisHandlerInit extends AxisHandler {
  onModuleInit?(): void | Promise<void>;
}
