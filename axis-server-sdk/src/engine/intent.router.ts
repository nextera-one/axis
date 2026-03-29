import { Injectable } from '@nestjs/common';
import { AxisFrame } from '../core/axis-bin';
import { HANDLER_METADATA_KEY } from '../decorators/handler.decorator';
import { INTENT_ROUTES_KEY, IntentRoute } from '../decorators/intent.decorator';

/**
 * Represents the outcome of an AXIS intent execution.
 *
 * @interface AxisEffect
 */
export interface AxisEffect {
  /** Whether the intent was processed successfully at the application level */
  ok: boolean;
  /** A descriptive string classifier for the result (e.g., 'FILE_CREATED', 'PONG') */
  effect: string;
  /** Optional binary payload (body) to be returned to the requester */
  body?: Uint8Array;
  /** Optional custom TLV headers to be included in the response frame */
  headers?: Map<number, Uint8Array>;
  /** Optional metadata for internal logging or audit (not sent to client) */
  metadata?: any;
}

/**
 * IntentRouter
 *
 * The central dispatching mechanism of the AXIS backend.
 * Maps binary intents (identified by their name in the header) to specialized handlers.
 *
 * **Features:**
 * 1. **Built-in Fast Path:** Handles high-frequency system intents (ping, time, echo) directly.
 * 2. **Dynamic Handler Registration:** Allows modules to register handlers at runtime.
 * 3. **Decorator-driven Registration:** Uses {@link registerHandler} to auto-register `@Intent`-decorated methods.
 * 4. **Polymorphic Handlers:** Supports both raw function handlers and object-based `{ handle }` handlers.
 *
 * @class IntentRouter
 */
@Injectable()
export class IntentRouter {
  /** Internal registry of dynamic intent handlers */
  private handlers = new Map<string, any>();

  /**
   * Registers a handler for a specific intent.
   * Handlers can be functions: `(body, headers) => Promise<Uint8Array | AxisEffect>`
   * Or objects with a method: `handle(frame: AxisFrame) => Promise<AxisEffect>`
   *
   * @param {string} intent - The unique intent identifier (e.g., 'axis.vault.create')
   * @param {any} handler - The handler function or object
   */
  register(intent: string, handler: any) {
    this.handlers.set(intent, handler);
  }

  /**
   * Automatically registers all `@Intent`-decorated methods from a handler instance.
   *
   * Reads the handler prefix from `@Handler` metadata (or falls back to `instance.name`),
   * then registers each `@Intent`-decorated method accordingly.
   *
   * @param {any} instance - The handler instance with `@Intent`-decorated methods
   */
  registerHandler(instance: any) {
    const handlerMeta = Reflect.getMetadata(
      HANDLER_METADATA_KEY,
      instance.constructor,
    );
    const prefix: string | undefined = handlerMeta?.intent || instance.name;

    const routes: IntentRoute[] =
      Reflect.getMetadata(INTENT_ROUTES_KEY, instance.constructor) || [];

    for (const route of routes) {
      const intentName = route.absolute
        ? route.action
        : `${prefix}.${route.action}`;
      const fn = instance[route.methodName].bind(instance);

      if (route.frame) {
        this.register(intentName, { handle: fn });
      } else {
        this.register(intentName, fn);
      }
    }
  }

  /**
   * Routes a decoded AXIS frame to the appropriate handler.
   *
   * **Precedence:**
   * 1. System Built-ins (`system.ping`, `public.ping`, `system.time`, `system.echo`)
   * 2. Meta-intent execution (`INTENT.EXEC` / `axis.intent.exec`)
   * 3. Dynamically registered handlers from modules.
   *
   * @param {AxisFrame} frame - The validated and decoded binary frame
   * @returns {Promise<AxisEffect>} The resulting effect of the execution
   * @throws {Error} If the intent header is missing or no handler is registered
   */
  async route(frame: AxisFrame): Promise<AxisEffect> {
    const start = process.hrtime();
    let intent = 'unknown';

    try {
      // Extract intent from header TLV (tag 3 = TLV_INTENT)
      const intentBytes = frame.headers.get(3);
      if (!intentBytes) throw new Error('Missing intent');
      intent = new TextDecoder().decode(intentBytes);

      let effect: AxisEffect;

      if (intent === 'system.ping' || intent === 'public.ping') {
        effect = {
          ok: true,
          effect: 'pong',
          headers: new Map([
            [100, new TextEncoder().encode('AXIS_BACKEND_V1')],
          ]),
          body: new TextEncoder().encode(
            JSON.stringify({
              status: 'ok',
              timestamp: new Date().toISOString(),
              version: '1.0.0',
            }),
          ),
        };
      } else if (intent === 'system.time') {
        const ts = Date.now().toString();
        effect = {
          ok: true,
          effect: 'time',
          body: new TextEncoder().encode(
            JSON.stringify({
              ts,
              iso: new Date().toISOString(),
            }),
          ),
        };
      } else if (intent === 'system.echo') {
        effect = {
          ok: true,
          effect: 'echo',
          body: frame.body,
        };
      } else if (intent === 'INTENT.EXEC' || intent === 'axis.intent.exec') {
        // Meta-intent: Unwrap and execute the inner intent
        try {
          const bodyJSON = JSON.parse(new TextDecoder().decode(frame.body));
          const innerIntent = bodyJSON.intent;
          const innerArgs = bodyJSON.args || {};

          if (!innerIntent) {
            throw new Error('INTENT.EXEC missing inner intent');
          }

          const innerFrame: AxisFrame = {
            ...frame,
            headers: new Map(frame.headers),
            body: new TextEncoder().encode(JSON.stringify(innerArgs)),
          };
          innerFrame.headers.set(3, new TextEncoder().encode(innerIntent));

          return await this.route(innerFrame);
        } catch (e: any) {
          throw new Error(`INTENT.EXEC unwrapping failed: ${e.message}`);
        }
      } else {
        const handler = this.handlers.get(intent);
        if (!handler) {
          throw new Error(`Intent not found: ${intent}`);
        }

        if (typeof handler === 'function') {
          const resultBody = await handler(frame.body, frame.headers);
          effect = {
            ok: true,
            effect: 'complete',
            body: resultBody,
          };
        } else {
          if (typeof (handler as any).handle === 'function') {
            effect = await (handler as any).handle(frame);
          } else if (typeof (handler as any).execute === 'function') {
            const bodyRes = await (handler as any).execute(
              frame.body,
              frame.headers,
            );
            effect = {
              ok: true,
              effect: 'complete',
              body: bodyRes,
            };
          } else {
            throw new Error(
              `Handler for ${intent} does not implement handle or execute`,
            );
          }
        }
      }

      this.recordLatency(intent, start);
      return effect;
    } catch (e: any) {
      console.error(`Error routing intent ${intent}:`, e.message);
      throw e;
    }
  }

  private recordLatency(intent: string, start: [number, number]) {
    const diff = process.hrtime(start);
    // Available for subclass telemetry hooks or future logging
    void diff;
  }
}
