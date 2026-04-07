import { Injectable, Logger, Optional } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { HANDLER_SENSORS_KEY } from "../decorators/handler-sensors.decorator";
import { INTENT_SENSORS_KEY } from "../decorators/intent-sensors.decorator";
import { INTENT_BODY_KEY } from "../decorators/intent-body.decorator";
import type { TlvValidatorFn } from "../decorators/tlv-field.decorator";
import { HANDLER_METADATA_KEY } from "../decorators/handler.decorator";
import { INTENT_METADATA_KEY, INTENT_ROUTES_KEY, IntentKind, IntentRoute, IntentTlvField } from "../decorators/intent.decorator";
import { buildDtoDecoder, extractDtoSchema } from "../decorators/dto-schema.util";
import { AxisSensor, normalizeSensorDecision, SensorInput } from "../sensor/axis-sensor";
import { type CceHandler, type CceHandlerContext, type CceHandlerResult, type CcePipelineConfig, type CcePipelineResult, executeCcePipeline } from "../cce/cce-pipeline";
import type { CceRequestEnvelope } from "../cce/cce.types";
import { AxisFrame } from "../core/axis-bin";

export interface IntentSchema {
  intent: string;
  version: number;
  bodyProfile: "TLV_MAP" | "RAW" | "TLV_OBJ" | "TLV_ARR";
  fields: Array<{
    name: string;
    tlv: number;
    kind: IntentTlvField["kind"];
    required?: boolean;
    maxLen?: number;
    max?: string;
    scope?: "header" | "body";
  }>;
}

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
  private readonly logger = new Logger(IntentRouter.name);

  /** Intents handled inline in route() — not in `handlers` map */
  private static readonly BUILTIN_INTENTS = new Set([
    "system.ping",
    "public.ping",
    "system.time",
    "system.echo",
    "INTENT.EXEC",
    "axis.intent.exec",
  ]);

  /** Internal registry of dynamic intent handlers */
  private handlers = new Map<string, any>();

  /** Per-intent sensor classes (resolved at call time) */
  private intentSensors = new Map<string, Function[]>();

  /** Per-intent body decoders */
  private intentDecoders = new Map<string, (buf: Buffer) => any>();

  /** Per-intent TLV schemas */
  private intentSchemas = new Map<string, IntentSchema>();

  /** Per-intent custom validators */
  private intentValidators = new Map<string, Map<number, TlvValidatorFn[]>>();

  /** Per-intent operation kind */
  private intentKinds = new Map<string, IntentKind>();

  /** CCE handler registry */
  private cceHandlers = new Map<string, CceHandler>();

  /** CCE pipeline configuration (set via configureCce) */
  private ccePipelineConfig: Omit<CcePipelineConfig, "handlers"> | null = null;

  constructor(@Optional() private readonly moduleRef?: ModuleRef) {}

  getSchema(intent: string): IntentSchema | undefined {
    return this.intentSchemas.get(intent);
  }

  getValidators(intent: string): Map<number, TlvValidatorFn[]> | undefined {
    return this.intentValidators.get(intent);
  }

  has(intent: string): boolean {
    return (
      this.handlers.has(intent) || IntentRouter.BUILTIN_INTENTS.has(intent)
    );
  }

  getRegisteredIntents(): string[] {
    return [...IntentRouter.BUILTIN_INTENTS, ...this.handlers.keys()];
  }

  getIntentEntry(intent: string): {
    schema?: IntentSchema;
    validators?: Map<number, TlvValidatorFn[]>;
    hasSensors: boolean;
    builtin: boolean;
    kind?: IntentKind;
  } | null {
    if (!this.has(intent)) return null;
    return {
      schema: this.intentSchemas.get(intent),
      validators: this.intentValidators.get(intent),
      hasSensors: this.intentSensors.has(intent),
      builtin: IntentRouter.BUILTIN_INTENTS.has(intent),
      kind: this.intentKinds.get(intent),
    };
  }

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

    // Read @HandlerSensors from the class (if any)
    const handlerSensors: Function[] =
      Reflect.getMetadata(HANDLER_SENSORS_KEY, instance.constructor) || [];

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

      this.registerIntentMeta(
        intentName,
        Object.getPrototypeOf(instance),
        String(route.methodName),
        handlerSensors,
      );
    }

    const proto = Object.getPrototypeOf(instance);
    for (const key of Object.getOwnPropertyNames(proto)) {
      const meta = Reflect.getMetadata(INTENT_METADATA_KEY, proto, key);
      if (!meta?.intent) continue;

      if (!this.handlers.has(meta.intent)) {
        this.register(meta.intent, (instance as any)[key].bind(instance));
      }

      this.registerIntentMeta(meta.intent, proto, key, handlerSensors);
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
    let intent = "unknown";

    try {
      // Extract intent from header TLV (tag 3 = TLV_INTENT)
      const intentBytes = frame.headers.get(3);
      if (!intentBytes) throw new Error("Missing intent");
      intent = new TextDecoder().decode(intentBytes);

      let effect: AxisEffect;

      if (intent === "system.ping" || intent === "public.ping") {
        this.logger.debug("PING received");
        effect = {
          ok: true,
          effect: "pong",
          headers: new Map([
            [100, new TextEncoder().encode("AXIS_BACKEND_V1")],
          ]),
          body: new TextEncoder().encode(
            JSON.stringify({
              status: "ok",
              timestamp: new Date().toISOString(),
              version: "1.0.0",
            }),
          ),
        };
      } else if (intent === "system.time") {
        const ts = Date.now().toString();
        effect = {
          ok: true,
          effect: "time",
          body: new TextEncoder().encode(
            JSON.stringify({
              ts,
              iso: new Date().toISOString(),
            }),
          ),
        };
      } else if (intent === "system.echo") {
        effect = {
          ok: true,
          effect: "echo",
          body: frame.body,
        };
      } else if (intent === "INTENT.EXEC" || intent === "axis.intent.exec") {
        // Meta-intent: Unwrap and execute the inner intent
        try {
          const bodyJSON = JSON.parse(new TextDecoder().decode(frame.body));
          const innerIntent = bodyJSON.intent;
          const innerArgs = bodyJSON.args || {};

          if (!innerIntent) {
            throw new Error("INTENT.EXEC missing inner intent");
          }

          this.logger.debug(`EXEC: routing to inner intent '${innerIntent}'`);

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

        const sensorClasses = this.intentSensors.get(intent);
        if (sensorClasses && sensorClasses.length > 0) {
          await this.runIntentSensors(sensorClasses, intent, frame);
        }

        const decoder = this.intentDecoders.get(intent);
        let decodedBody: any = frame.body;
        if (decoder) {
          try {
            decodedBody = decoder(Buffer.from(frame.body));
          } catch (decodeErr: any) {
            throw new Error(
              `IntentBody decode failed for ${intent}: ${decodeErr.message}`,
            );
          }
        }

        if (typeof handler === "function") {
          const resultBody = decoder
            ? await handler(decodedBody, frame.headers)
            : await handler(frame.body, frame.headers);
          effect = {
            ok: true,
            effect: "complete",
            body: resultBody,
          };
        } else {
          if (typeof (handler as any).handle === "function") {
            effect = await (handler as any).handle(frame);
          } else if (typeof (handler as any).execute === "function") {
            const bodyRes = decoder
              ? await (handler as any).execute(decodedBody, frame.headers)
              : await (handler as any).execute(frame.body, frame.headers);
            effect = {
              ok: true,
              effect: "complete",
              body: bodyRes,
            };
          } else {
            throw new Error(
              `Handler for ${intent} does not implement handle or execute`,
            );
          }
        }
      }

      this.logIntent(intent, start, true);
      return effect;
    } catch (e: any) {
      this.logIntent(intent, start, false, e.message);
      throw e;
    }
  }

  private logIntent(
    intent: string,
    start: [number, number],
    ok: boolean,
    error?: string,
  ) {
    const diff = process.hrtime(start);
    const ms = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
    if (ok) {
      this.logger.debug(`${intent} completed in ${ms}ms`);
    } else {
      this.logger.warn(`${intent} failed in ${ms}ms - ${error}`);
    }
  }

  registerIntentMeta(
    intent: string,
    proto: object,
    methodName: string,
    handlerSensors?: Function[],
  ): void {
    const decoder = Reflect.getMetadata(INTENT_BODY_KEY, proto, methodName);
    if (decoder) {
      this.intentDecoders.set(intent, decoder);
    }

    const intentSensors = Reflect.getMetadata(
      INTENT_SENSORS_KEY,
      proto,
      methodName,
    );
    const combined = [
      ...(handlerSensors || []),
      ...(Array.isArray(intentSensors) ? intentSensors : []),
    ];
    if (combined.length > 0) {
      this.intentSensors.set(intent, combined);
    }

    const meta = Reflect.getMetadata(INTENT_METADATA_KEY, proto, methodName);
    if (meta) {
      this.storeSchema(meta);
      if (meta.kind) {
        this.intentKinds.set(intent, meta.kind);
      }
    }
  }

  private async runIntentSensors(
    sensorClasses: Function[],
    intent: string,
    frame: AxisFrame,
  ): Promise<void> {
    if (!this.moduleRef) return;

    for (const SensorClass of sensorClasses) {
      let sensor: AxisSensor;
      try {
        sensor = this.moduleRef.get(SensorClass as any, { strict: false });
      } catch {
        this.logger.warn(
          `@IntentSensors: could not resolve ${SensorClass.name} for ${intent}`,
        );
        continue;
      }

      const sensorInput: SensorInput = {
        rawBytes: frame.body,
        intent,
        body: frame.body,
        headerTLVs: frame.headers as any,
        metadata: { phase: "intent", intent },
      };

      if (sensor.supports && !sensor.supports(sensorInput)) continue;

      const decision = normalizeSensorDecision(await sensor.run(sensorInput));
      if (!decision.allow) {
        const reason = decision.reasons[0] || `${sensor.name}:DENIED`;
        this.logger.warn(
          `Intent sensor ${sensor.name} denied ${intent}: ${reason}`,
        );
        throw new Error(`SENSOR_DENY:${reason}`);
      }
    }
  }

  // ===========================================================================
  // CCE — Capsule-Carried Encryption Support
  // ===========================================================================

  /**
   * Configure the CCE pipeline.
   * Must be called before routeCce() can process encrypted requests.
   */
  configureCce(config: Omit<CcePipelineConfig, "handlers">): void {
    this.ccePipelineConfig = config;
    this.logger.log("CCE pipeline configured");
  }

  /**
   * Register a CCE-encrypted intent handler.
   * CCE handlers receive decrypted payloads and execution context.
   */
  registerCceHandler(intent: string, handler: CceHandler): void {
    this.cceHandlers.set(intent, handler);
    this.logger.debug(`CCE handler registered: ${intent}`);
  }

  /**
   * Check if a CCE handler exists for the given intent.
   */
  hasCceHandler(intent: string): boolean {
    return this.cceHandlers.has(intent);
  }

  /**
   * Route a CCE-encrypted request through the full pipeline.
   *
   * Steps:
   * 1. Sensor chain (envelope validation → capsule verification → replay → decrypt)
   * 2. Execution context derivation
   * 3. Handler execution
   * 4. Response encryption
   * 5. Witness recording
   */
  async routeCce(envelope: CceRequestEnvelope): Promise<CcePipelineResult> {
    if (!this.ccePipelineConfig) {
      return {
        ok: false,
        error: {
          code: "CCE_NOT_CONFIGURED",
          message: "CCE pipeline not configured. Call configureCce() first.",
        },
        status: "ERROR",
      };
    }

    const config: CcePipelineConfig = {
      ...this.ccePipelineConfig,
      handlers: this.cceHandlers,
    };

    return executeCcePipeline(envelope, config);
  }

  private storeSchema(meta: {
    intent: string;
    tlv?: IntentTlvField[];
    dto?: Function;
    bodyProfile?: "TLV_MAP" | "RAW" | "TLV_OBJ" | "TLV_ARR";
    kind?: IntentKind;
  }): void {
    if (meta.dto) {
      if (meta.tlv && meta.tlv.length > 0) {
        this.logger.warn(
          `${meta.intent}: both 'dto' and 'tlv' specified - using dto, ignoring tlv`,
        );
      }

      const extracted = extractDtoSchema(meta.dto);
      const schema: IntentSchema = {
        intent: meta.intent,
        version: 1,
        bodyProfile: meta.bodyProfile || "TLV_MAP",
        fields: extracted.fields.map((f) => ({
          name: f.name,
          tlv: f.tag,
          kind: f.kind,
          required: f.required,
          maxLen: f.maxLen,
          max: f.max,
          scope: f.scope,
        })),
      };

      this.intentSchemas.set(meta.intent, schema);

      if (extracted.validators.size > 0) {
        this.intentValidators.set(meta.intent, extracted.validators);
      }

      if (!this.intentDecoders.has(meta.intent)) {
        this.intentDecoders.set(meta.intent, buildDtoDecoder(meta.dto));
      }

      return;
    }

    if (!meta.tlv || meta.tlv.length === 0) return;

    const schema: IntentSchema = {
      intent: meta.intent,
      version: 1,
      bodyProfile: meta.bodyProfile || "TLV_MAP",
      fields: meta.tlv.map((f) => ({
        name: f.name,
        tlv: f.tag,
        kind: f.kind,
        required: f.required,
        maxLen: f.maxLen,
        max: f.max,
        scope: f.scope,
      })),
    };

    this.intentSchemas.set(meta.intent, schema);
  }
}
