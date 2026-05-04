import { decodeChainEnvelope, decodeChainRequest } from "@nextera.one/axis-protocol";

import { HANDLER_SENSORS_KEY } from "../decorators/handler-sensors.decorator";
import { CAPSULE_POLICY_METADATA_KEY, type CapsulePolicyOptions, mergeCapsulePolicyOptions, normalizeCapsulePolicyOptions } from "../decorators/capsule-policy.decorator";
import { INTENT_SENSORS_KEY } from "../decorators/intent-sensors.decorator";
import { AXIS_ANONYMOUS_KEY, AXIS_AUTHORIZED_KEY, AXIS_PUBLIC_KEY, AXIS_RATE_LIMIT_KEY, type AxisRateLimitConfig, CONTRACT_METADATA_KEY, REQUIRED_PROOF_METADATA_KEY, type RequiredProofKind, SENSITIVITY_METADATA_KEY } from "../decorators/intent-policy.decorator";
import { INTENT_BODY_KEY } from "../decorators/intent-body.decorator";
import type { TlvValidatorFn } from "../decorators/tlv-field.decorator";
import { AxisObserverBinding, AxisObserverRef, OBSERVER_BINDINGS_KEY } from "../decorators/observer.decorator";
import { HANDLER_METADATA_KEY } from "../decorators/handler.decorator";
import { type AxisIntentSensorBinding, type AxisIntentSensorBindingInput, type AxisIntentSensorRef, INTENT_METADATA_KEY, INTENT_ROUTES_KEY, IntentKind, IntentRoute, IntentTlvField, toIntentSensorBinding } from "../decorators/intent.decorator";
import { CHAIN_METADATA_KEY } from "../decorators/chain.decorator";
import { buildDtoDecoder, extractDtoSchema } from "../decorators/dto-schema.util";
import { ObserverDispatcherService } from "./observer-dispatcher.service";
import { inlineCapsuleAllowsIntent, inlineCapsuleSatisfiesScopes, isInlineCapsuleExpired, normalizeInlineCapsule, resolvePolicyScopes } from "../security/inline-capsule";
import type { AxisDependencyResolver } from "./axis-dependency-resolver";
import { SensorRegistry } from "./registry/sensor.registry";
import { getAxisExecutionContext, mergeAxisExecutionContext, withAxisExecutionContext } from "./axis-execution-context";
import type { SensitivityLevel } from "../schemas/axis-schemas";
import { AxisSensor, normalizeSensorDecision, SensorInput } from "../sensor/axis-sensor";
import { createAxisLogger } from "../utils/axis-logger";
import { type CceHandler, type CcePipelineConfig, type CcePipelineResult, executeCcePipeline } from "../cce/cce-pipeline";
import { AxisError } from "../core/axis-error";
import { AxisChainEnvelope, AxisChainRequest, ChainOptions, RegisteredChainConfig } from "./axis-chain.types";
import { TLV_ACTOR_ID, TLV_CAPSULE, TLV_INTENT, TLV_NODE, TLV_PROOF_REF, TLV_REALM } from "../core/constants";
import type { CceRequestEnvelope } from "../cce/cce.types";
import { AxisFrame } from "../core/axis-bin";

function observerRefKey(ref: AxisObserverRef): string {
  return typeof ref === "string" ? ref : ref.name;
}

function sensorRefKey(ref: AxisIntentSensorRef): string {
  return typeof ref === "string" ? ref : ref.name;
}

function sensorBindingKey(binding: AxisIntentSensorBinding): string {
  return `${binding.when}:${sensorRefKey(binding.ref)}`;
}

function mergeIntentSensorBindings(
  ...sensorGroups: Array<AxisIntentSensorBindingInput[] | undefined>
): AxisIntentSensorBinding[] {
  const merged = new Map<string, AxisIntentSensorBinding>();

  for (const group of sensorGroups) {
    if (!Array.isArray(group)) continue;

    for (const input of group) {
      const binding = toIntentSensorBinding(input);
      const key = sensorBindingKey(binding);
      const existing = merged.get(key);

      if (
        !existing ||
        (typeof existing.ref === "string" && typeof binding.ref !== "string")
      ) {
        merged.set(key, binding);
      }
    }
  }

  return Array.from(merged.values());
}

function isAxisSensorInstance(value: unknown): value is AxisSensor {
  return (
    !!value &&
    typeof (value as AxisSensor).name === "string" &&
    typeof (value as AxisSensor).run === "function"
  );
}

function mergeObserverBindings(
  bindings: AxisObserverBinding[],
): AxisObserverBinding[] {
  const merged = new Map<string, AxisObserverBinding>();

  for (const binding of bindings) {
    for (const ref of binding.refs) {
      const key = observerRefKey(ref);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          refs: [ref],
          tags: binding.tags ? [...new Set(binding.tags)] : undefined,
          events: binding.events ? [...new Set(binding.events)] : undefined,
        });
        continue;
      }

      existing.tags = Array.from(
        new Set([...(existing.tags || []), ...(binding.tags || [])]),
      );
      existing.events =
        existing.events === undefined || binding.events === undefined
          ? undefined
          : Array.from(new Set([...existing.events, ...binding.events]));
    }
  }

  return Array.from(merged.values());
}

function normalizeChainConfig(
  decoratorConfig?: RegisteredChainConfig,
  intentConfig?: boolean | ChainOptions,
): RegisteredChainConfig | undefined {
  if (decoratorConfig) {
    return decoratorConfig;
  }

  if (!intentConfig) {
    return undefined;
  }

  if (intentConfig === true) {
    return { enabled: true };
  }

  return {
    enabled: true,
    ...intentConfig,
  };
}

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
 * Summary of all intents and policies registered under a handler class.
 */
export interface HandlerSummary {
  /** Handler class name (e.g. 'UsersHandler') */
  handler: string;
  /** Intent namespace prefix from @Handler('auth') */
  prefix?: string;
  /** All intents registered under this handler */
  intents: string[];
  /** True if any intent in this handler is public */
  isPublic: boolean;
  /** True if any intent in this handler is anonymous-accessible */
  isAnonymous: boolean;
  /** True if any intent in this handler is authorized-session-only */
  isAuthorized: boolean;
  /** Union of all required proof kinds across intents */
  requiredProof?: RequiredProofKind[];
  /** Contract metadata (typically class-level, first found wins) */
  contract?: Record<string, any>;
  /** Sensitivity level (first found wins) */
  sensitivity?: SensitivityLevel;
  /** Rate limit config (first found wins) */
  rateLimit?: AxisRateLimitConfig;
  /** Capsule policy (first found wins) */
  capsulePolicy?: CapsulePolicyOptions;
  /** Class-level sensor bindings from @HandlerSensors (applied before every intent in this handler) */
  classSensors?: AxisIntentSensorBinding[];
  /** Class-level observer bindings from @Handler({ observe: [...] }) */
  classObservers?: AxisObserverBinding[];
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
export class IntentRouter {
  private readonly logger = createAxisLogger(IntentRouter.name);
  private readonly decoder = new TextDecoder();
  private readonly encoder = new TextEncoder();
  private readonly dependencyResolver?: AxisDependencyResolver;
  private readonly observerDispatcher?: ObserverDispatcherService;
  private readonly sensorRegistry?: SensorRegistry;

  /** Intents handled inline in route() — not in `handlers` map */
  private static readonly BUILTIN_INTENTS = new Set([
    "system.ping",
    "public.ping",
    "system.time",
    "system.echo",
    "CHAIN.EXEC",
    "axis.chain.exec",
    "INTENT.EXEC",
    "axis.intent.exec",
  ]);

  /** Internal registry of dynamic intent handlers */
  private handlers = new Map<string, any>();

  /** Per-intent sensor refs (resolved through SensorRegistry at call time) */
  private intentSensors = new Map<string, AxisIntentSensorBinding[]>();

  /** Per-intent handler identifier (e.g. UsersHandler.usersPage) */
  private intentHandlerRefs = new Map<string, string>();

  /** Per-intent body decoders */
  private intentDecoders = new Map<string, (buf: Buffer) => any>();

  /** Per-intent TLV schemas */
  private intentSchemas = new Map<string, IntentSchema>();

  /** Per-intent custom validators */
  private intentValidators = new Map<string, Map<number, TlvValidatorFn[]>>();

  /** Per-intent operation kind */
  private intentKinds = new Map<string, IntentKind>();

  /** Per-intent chain configuration */
  private intentChains = new Map<string, RegisteredChainConfig>();

  /** Per-intent observer bindings */
  private intentObservers = new Map<string, AxisObserverBinding[]>();

  /** Per-intent capsule policies */
  private intentCapsulePolicies = new Map<string, CapsulePolicyOptions>();

  /** Per-intent sensitivity level */
  private intentSensitivity = new Map<string, SensitivityLevel>();

  /** Per-intent execution contract overrides */
  private intentContracts = new Map<string, Record<string, any>>();

  /** Per-intent required proof kinds */
  private intentRequiredProof = new Map<string, RequiredProofKind[]>();

  /** Intents flagged as public (no auth required) */
  private publicIntents = new Set<string>();

  /** Intents flagged as anonymous-session accessible */
  private anonymousIntents = new Set<string>();

  /** Intents flagged as authorized-session accessible */
  private authorizedIntents = new Set<string>();

  /** Per-intent rate limit config */
  private intentRateLimits = new Map<string, AxisRateLimitConfig>();

  /** CCE handler registry */
  private cceHandlers = new Map<string, CceHandler>();

  /** CCE pipeline configuration (set via configureCce) */
  private ccePipelineConfig: Omit<CcePipelineConfig, "handlers"> | null = null;

  /** Reverse index: handler class name → list of registered intents */
  private handlerIntents = new Map<string, string[]>();
  /** Handler class name → intent namespace prefix (from @Handler('auth')) */
  private handlerPrefixes = new Map<string, string>();
  /** Handler namespace prefix → handler class name, used by `handler...intent` lookup. */
  private handlerByPrefix = new Map<string, string>();
  /** Intent → handler class name, avoids scanning handlerIntents for normal lookups. */
  private handlerByIntent = new Map<string, string>();
  /** Handler class name → class-level sensor bindings (from @HandlerSensors) */
  private handlerClassSensors = new Map<string, AxisIntentSensorBinding[]>();
  /** Handler class name → class-level observer bindings (from @Handler({ observe: [...] })) */
  private handlerClassObservers = new Map<string, AxisObserverBinding[]>();

  constructor(
    dependencyResolver?: AxisDependencyResolver,
    observerDispatcher?: ObserverDispatcherService,
    sensorRegistry?: SensorRegistry,
  ) {
    this.dependencyResolver = dependencyResolver;
    this.observerDispatcher = observerDispatcher;
    this.sensorRegistry = sensorRegistry;
  }

  getSchema(intent: string): IntentSchema | undefined {
    return this.intentSchemas.get(this.resolveIntentAlias(intent));
  }

  getValidators(intent: string): Map<number, TlvValidatorFn[]> | undefined {
    return this.intentValidators.get(this.resolveIntentAlias(intent));
  }

  has(intent: string): boolean {
    const resolved = this.resolveIntentAlias(intent);
    return (
      this.handlers.has(resolved) || IntentRouter.BUILTIN_INTENTS.has(resolved)
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
    chain?: RegisteredChainConfig;
    capsulePolicy?: CapsulePolicyOptions;
    observerCount: number;
  } | null {
    const resolved = this.resolveIntentAlias(intent);
    if (!this.has(resolved)) return null;
    return {
      schema: this.intentSchemas.get(resolved),
      validators: this.intentValidators.get(resolved),
      hasSensors: this.intentSensors.has(resolved),
      builtin: IntentRouter.BUILTIN_INTENTS.has(resolved),
      kind: this.intentKinds.get(resolved),
      chain: this.intentChains.get(resolved),
      capsulePolicy: this.intentCapsulePolicies.get(resolved),
      observerCount: this.getObservers(resolved).length,
    };
  }

  getChainConfig(intent: string): RegisteredChainConfig | undefined {
    return this.intentChains.get(this.resolveIntentAlias(intent));
  }

  getObservers(intent: string): AxisObserverBinding[] {
    return this.intentObservers.get(this.resolveIntentAlias(intent)) || [];
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
    if (typeof handler === "function" && handler.name) {
      this.intentHandlerRefs.set(intent, handler.name);
    } else if (handler && typeof handler === "object") {
      const objectName = handler.constructor?.name;
      if (objectName) {
        this.intentHandlerRefs.set(intent, `${objectName}.handle`);
      }
    } else {
      this.intentHandlerRefs.set(intent, `intent:${intent}`);
    }
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
    const routedMethods = new Set(
      routes.map((route) => String(route.methodName)),
    );

    // Read @HandlerSensors from the class (if any)
    const handlerSensors: AxisIntentSensorBindingInput[] =
      Reflect.getMetadata(HANDLER_SENSORS_KEY, instance.constructor) || [];
    const handlerObservers: AxisObserverBinding[] =
      Reflect.getMetadata(OBSERVER_BINDINGS_KEY, instance.constructor) || [];
    if (prefix) {
      this.trackHandlerMeta(
        instance.constructor.name,
        prefix,
        handlerSensors,
        handlerObservers,
      );
    }

    const proto = Object.getPrototypeOf(instance);

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
      this.intentHandlerRefs.set(
        intentName,
        `${instance.constructor.name}.${String(route.methodName)}`,
      );
      this.trackHandlerIntent(instance.constructor.name, intentName);

      this.registerIntentMeta(
        intentName,
        proto,
        String(route.methodName),
        handlerSensors,
        handlerObservers,
      );
    }

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (routedMethods.has(key)) continue;

      const meta = Reflect.getMetadata(INTENT_METADATA_KEY, proto, key);
      if (!meta?.intent) continue;

      const intentName = meta.absolute
        ? meta.intent
        : `${prefix}.${meta.intent}`;

      if (!this.handlers.has(intentName)) {
        this.register(intentName, (instance as any)[key].bind(instance));
      }

      this.registerIntentMeta(
        intentName,
        proto,
        key,
        handlerSensors,
        handlerObservers,
      );
      this.trackHandlerIntent(instance.constructor.name, intentName);
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
    let handlerRef: string | undefined;

    try {
      const intentBytes = frame.headers.get(TLV_INTENT);
      if (!intentBytes) throw new Error("Missing intent");
      intent = this.resolveIntentAlias(this.decoder.decode(intentBytes));
      handlerRef = this.intentHandlerRefs.get(intent);
      const observerBindings = this.getObservers(intent);

      await this.emitIntentObservers(observerBindings, {
        event: "intent.received",
        timestamp: Date.now(),
        intent,
        handler: handlerRef,
        frame,
      });

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
      } else if (intent === "CHAIN.EXEC" || intent === "axis.chain.exec") {
        const chainRequest = this.parseChainRequestBody(frame.body);
        effect = await this.executeChainRequest(frame, chainRequest);
      } else if (intent === "INTENT.EXEC" || intent === "axis.intent.exec") {
        const execBody = this.parseIntentExecBody(frame.body);
        const innerIntent = execBody.intent;
        const innerArgs = execBody.args || {};

        if (!innerIntent) {
          throw new Error("INTENT.EXEC missing inner intent");
        }

        this.logger.debug(`EXEC: routing to inner intent '${innerIntent}'`);

        const innerHeaders = new Map(frame.headers);
        innerHeaders.set(TLV_INTENT, this.encoder.encode(innerIntent));

        const inlineCapsule = this.toInlineCapsuleRecord(execBody.capsule);
        const capsuleId = this.extractInlineCapsuleId(inlineCapsule);
        if (capsuleId) {
          innerHeaders.set(TLV_CAPSULE, this.encoder.encode(capsuleId));
          innerHeaders.set(TLV_PROOF_REF, this.encoder.encode(capsuleId));
        }

        const innerFrame = withAxisExecutionContext(
          {
            ...frame,
            headers: innerHeaders,
            body: this.encodeJson(innerArgs),
          },
          mergeAxisExecutionContext(getAxisExecutionContext(frame), {
            metaIntent: "INTENT.EXEC",
            actorId: this.getActorIdFromFrame(frame),
            inlineCapsule,
          }) || {},
        );

        effect = await this.route(innerFrame);
      } else {
        const handler = this.handlers.get(intent);
        if (!handler) {
          throw new Error(`Intent not found: ${intent}`);
        }

        const sensorBindings = this.intentSensors.get(intent);
        if (sensorBindings && sensorBindings.length > 0) {
          await this.runIntentSensors(sensorBindings, intent, frame, "before");
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

        this.enforceCapsulePolicy(
          intent,
          frame,
          decodedBody,
          this.getEffectiveCapsulePolicy(intent, frame),
        );

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

        if (sensorBindings && sensorBindings.length > 0) {
          await this.runIntentSensors(sensorBindings, intent, frame, "after", {
            decodedBody,
            effect,
          });
        }
      }

      await this.emitIntentObservers(observerBindings, {
        event: "intent.completed",
        timestamp: Date.now(),
        intent,
        handler: handlerRef,
        frame,
        effect,
        metadata: effect.metadata,
      });

      this.logIntent(intent, start, true);
      return effect;
    } catch (e: any) {
      await this.emitIntentObservers(this.getObservers(intent), {
        event: "intent.failed",
        timestamp: Date.now(),
        intent,
        handler: handlerRef,
        frame,
        error: e.message,
      });
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
    handlerSensors?: AxisIntentSensorBindingInput[],
    handlerObservers?: AxisObserverBinding[],
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
    const meta = Reflect.getMetadata(INTENT_METADATA_KEY, proto, methodName);
    const combined = mergeIntentSensorBindings(
      handlerSensors,
      Array.isArray(intentSensors) ? intentSensors : undefined,
      Array.isArray(meta?.is) ? meta.is : undefined,
    );
    if (combined.length > 0) {
      this.intentSensors.set(intent, combined);
    }

    const methodObservers: AxisObserverBinding[] =
      Reflect.getMetadata(OBSERVER_BINDINGS_KEY, proto, methodName) || [];
    const observers = mergeObserverBindings([
      ...(handlerObservers || []),
      ...methodObservers,
    ]);
    if (observers.length > 0) {
      this.intentObservers.set(intent, observers);
    }

    const handlerCapsulePolicy = Reflect.getMetadata(
      CAPSULE_POLICY_METADATA_KEY,
      proto.constructor,
    ) as CapsulePolicyOptions | undefined;
    const methodCapsulePolicy = Reflect.getMetadata(
      CAPSULE_POLICY_METADATA_KEY,
      proto,
      methodName,
    ) as CapsulePolicyOptions | undefined;
    const capsulePolicy = mergeCapsulePolicyOptions(
      handlerCapsulePolicy,
      methodCapsulePolicy,
    );
    if (capsulePolicy) {
      this.intentCapsulePolicies.set(intent, capsulePolicy);
    }

    if (meta) {
      this.storeSchema({ ...meta, intent });
      if (meta.kind) {
        this.intentKinds.set(intent, meta.kind);
      }

      const chainMeta = Reflect.getMetadata(
        CHAIN_METADATA_KEY,
        proto,
        methodName,
      ) as RegisteredChainConfig | undefined;
      const chainConfig = normalizeChainConfig(chainMeta, meta.chain);
      if (chainConfig) {
        this.intentChains.set(intent, chainConfig);
      }
    }

    // ── @Sensitivity ────────────────────────────────────────────────────────
    const methodSensitivity: SensitivityLevel | undefined = Reflect.getMetadata(
      SENSITIVITY_METADATA_KEY,
      proto,
      methodName,
    );
    const classSensitivity: SensitivityLevel | undefined = Reflect.getMetadata(
      SENSITIVITY_METADATA_KEY,
      proto.constructor,
    );
    const sensitivity =
      meta?.sensitivity ?? methodSensitivity ?? classSensitivity;
    if (sensitivity) {
      this.intentSensitivity.set(intent, sensitivity);
    }

    // ── @Contract ───────────────────────────────────────────────────────────
    const methodContract: Record<string, any> | undefined = Reflect.getMetadata(
      CONTRACT_METADATA_KEY,
      proto,
      methodName,
    );
    const classContract: Record<string, any> | undefined = Reflect.getMetadata(
      CONTRACT_METADATA_KEY,
      proto.constructor,
    );
    const contract = methodContract ?? classContract;
    if (contract) {
      this.intentContracts.set(intent, contract);
    }

    // ── @RequiredProof / @Capsule / @Witness ─────────────────────────────────
    const methodProof: RequiredProofKind[] | undefined = Reflect.getMetadata(
      REQUIRED_PROOF_METADATA_KEY,
      proto,
      methodName,
    );
    const classProof: RequiredProofKind[] | undefined = Reflect.getMetadata(
      REQUIRED_PROOF_METADATA_KEY,
      proto.constructor,
    );
    const requiredProof = methodProof ?? classProof;
    if (requiredProof && requiredProof.length > 0) {
      this.intentRequiredProof.set(intent, requiredProof);
    }

    // ── @AxisPublic ──────────────────────────────────────────────────────────
    const isPublicMethod: boolean | undefined = Reflect.getMetadata(
      AXIS_PUBLIC_KEY,
      proto,
      methodName,
    );
    const isPublicClass: boolean | undefined = Reflect.getMetadata(
      AXIS_PUBLIC_KEY,
      proto.constructor,
    );
    if (isPublicMethod || isPublicClass) {
      this.publicIntents.add(intent);
    }

    // ── @AxisAnonymous ───────────────────────────────────────────────────────
    const isAnonMethod: boolean | undefined = Reflect.getMetadata(
      AXIS_ANONYMOUS_KEY,
      proto,
      methodName,
    );
    const isAnonClass: boolean | undefined = Reflect.getMetadata(
      AXIS_ANONYMOUS_KEY,
      proto.constructor,
    );
    if (isAnonMethod || isAnonClass) {
      this.anonymousIntents.add(intent);
    }

    //TODO add @AxisAuthorized   and logic

    // ── @AxisAuthorized ──────────────────────────────────────────────────────────
    const isAuthorizedMethod: boolean | undefined = Reflect.getMetadata(
      AXIS_AUTHORIZED_KEY,
      proto,
      methodName,
    );
    const isAuthorizedClass: boolean | undefined = Reflect.getMetadata(
      AXIS_AUTHORIZED_KEY,
      proto.constructor,
    );
    if (isAuthorizedMethod || isAuthorizedClass) {
      this.authorizedIntents.add(intent);
    }

    // ── @AxisRateLimit ───────────────────────────────────────────────────────
    const rateLimit: AxisRateLimitConfig | undefined = Reflect.getMetadata(
      AXIS_RATE_LIMIT_KEY,
      proto,
      methodName,
    );
    if (rateLimit) {
      this.intentRateLimits.set(intent, rateLimit);
    }
  }

  // ─── Policy Getters ────────────────────────────────────────────────────────

  getSensitivity(intent: string): SensitivityLevel | undefined {
    return this.intentSensitivity.get(this.resolveIntentAlias(intent));
  }

  getContract(intent: string): Record<string, any> | undefined {
    return this.intentContracts.get(this.resolveIntentAlias(intent));
  }

  getRequiredProof(intent: string): RequiredProofKind[] | undefined {
    return this.intentRequiredProof.get(this.resolveIntentAlias(intent));
  }

  isPublic(intent: string): boolean {
    return this.publicIntents.has(this.resolveIntentAlias(intent));
  }

  isAnonymous(intent: string): boolean {
    return this.anonymousIntents.has(this.resolveIntentAlias(intent));
  }

  isAuthorized(intent: string): boolean {
    return this.authorizedIntents.has(this.resolveIntentAlias(intent));
  }

  getRateLimit(intent: string): AxisRateLimitConfig | undefined {
    return this.intentRateLimits.get(this.resolveIntentAlias(intent));
  }

  // ─── Handler-level Getters ─────────────────────────────────────────────────

  /** All intents registered under the given handler class name. */
  getHandlerIntents(handlerName: string): string[] {
    return this.handlerIntents.get(handlerName) ?? [];
  }

  /** Returns the handler class name that owns the given intent, or undefined if not found. */
  getHandlerByIntent(intent: string): string | undefined {
    const resolved = this.resolveIntentAlias(intent);
    return this.handlerByIntent.get(resolved);
  }

  /** All registered handler class names. */
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlerIntents.keys());
  }

  /** The system/builtin intents (ping, time, echo, chain, intent.exec). */
  getSystemIntents(): string[] {
    return [...IntentRouter.BUILTIN_INTENTS];
  }

  /** True if every intent in the handler is public, or any one is public — returns true if ANY intent is @AxisPublic. */
  isHandlerPublic(handlerName: string): boolean {
    return this.getHandlerIntents(handlerName).some((i) => this.isPublic(i));
  }

  /** True if any intent in the handler is @AxisAnonymous. */
  isHandlerAnonymous(handlerName: string): boolean {
    return this.getHandlerIntents(handlerName).some((i) => this.isAnonymous(i));
  }

  /** True if any intent in the handler is @AxisAuthorized. */
  isHandlerAuthorized(handlerName: string): boolean {
    return this.getHandlerIntents(handlerName).some((i) =>
      this.isAuthorized(i),
    );
  }

  /** Union of all required proof kinds across the handler's intents (deduplicated). */
  getHandlerProof(handlerName: string): RequiredProofKind[] | undefined {
    const all = this.getHandlerIntents(handlerName).flatMap(
      (i) => this.getRequiredProof(i) ?? [],
    );
    if (all.length === 0) return undefined;
    return [...new Set(all)];
  }

  /** Contract from the first intent that has one (class-level contracts propagate to all intents). */
  getHandlerContract(handlerName: string): Record<string, any> | undefined {
    for (const intent of this.getHandlerIntents(handlerName)) {
      const contract = this.getContract(intent);
      if (contract) return contract;
    }
    return undefined;
  }

  /** Sensitivity from the first intent that has one. */
  getHandlerSensitivity(handlerName: string): SensitivityLevel | undefined {
    for (const intent of this.getHandlerIntents(handlerName)) {
      const sensitivity = this.getSensitivity(intent);
      if (sensitivity) return sensitivity;
    }
    return undefined;
  }

  /** Rate limit from the first intent that has one. */
  getHandlerRateLimit(handlerName: string): AxisRateLimitConfig | undefined {
    for (const intent of this.getHandlerIntents(handlerName)) {
      const rateLimit = this.getRateLimit(intent);
      if (rateLimit) return rateLimit;
    }
    return undefined;
  }

  /** Capsule policy from the first intent that has one. */
  getHandlerCapsulePolicy(
    handlerName: string,
  ): CapsulePolicyOptions | undefined {
    for (const intent of this.getHandlerIntents(handlerName)) {
      const policy = this.intentCapsulePolicies.get(intent);
      if (policy) return policy;
    }
    return undefined;
  }

  /** Intent namespace prefix declared in @Handler('auth'). */
  getHandlerPrefix(handlerName: string): string | undefined {
    return this.handlerPrefixes.get(handlerName);
  }

  /** Class-level sensor bindings from @HandlerSensors (run before every intent in this handler). */
  getHandlerClassSensors(
    handlerName: string,
  ): AxisIntentSensorBinding[] | undefined {
    return this.handlerClassSensors.get(handlerName);
  }

  /** Class-level observer bindings from @Handler({ observe: [...] }). */
  getHandlerClassObservers(
    handlerName: string,
  ): AxisObserverBinding[] | undefined {
    return this.handlerClassObservers.get(handlerName);
  }

  /**
   * Resolves the optional `handler...intent` wire shorthand to a registered
   * canonical intent. Existing exact intent names always win.
   */
  resolveIntentAlias(intent: string): string {
    if (this.handlers.has(intent) || IntentRouter.BUILTIN_INTENTS.has(intent)) {
      return intent;
    }

    const separator = "...";
    const separatorIndex = intent.indexOf(separator);
    if (separatorIndex <= 0) return intent;

    const handlerKey = intent.slice(0, separatorIndex);
    const action = intent.slice(separatorIndex + separator.length);
    if (!handlerKey || !action) return intent;

    const handlerName =
      this.handlerByPrefix.get(handlerKey) ??
      (this.handlerIntents.has(handlerKey) ? handlerKey : undefined);
    if (!handlerName) return intent;

    const prefix = this.getHandlerPrefix(handlerName) ?? handlerKey;
    const handlerIntents = this.getHandlerIntents(handlerName);
    const prefixedIntent = `${prefix}.${action}`;
    if (handlerIntents.includes(prefixedIntent)) return prefixedIntent;

    if (handlerIntents.includes(action)) return action;

    const suffix = `.${action}`;
    const suffixMatches = handlerIntents.filter((candidate) =>
      candidate.endsWith(suffix),
    );
    return suffixMatches.length === 1 ? suffixMatches[0] : intent;
  }

  /** Full summary of a handler's registered intents and aggregated policies. Returns null if unknown. */
  getHandlerSummary(handlerName: string): HandlerSummary | null {
    const intents = this.getHandlerIntents(handlerName);
    if (intents.length === 0) return null;
    return {
      handler: handlerName,
      prefix: this.getHandlerPrefix(handlerName),
      intents,
      isPublic: this.isHandlerPublic(handlerName),
      isAnonymous: this.isHandlerAnonymous(handlerName),
      isAuthorized: this.isHandlerAuthorized(handlerName),
      requiredProof: this.getHandlerProof(handlerName),
      contract: this.getHandlerContract(handlerName),
      sensitivity: this.getHandlerSensitivity(handlerName),
      rateLimit: this.getHandlerRateLimit(handlerName),
      capsulePolicy: this.getHandlerCapsulePolicy(handlerName),
      classSensors: this.getHandlerClassSensors(handlerName),
      classObservers: this.getHandlerClassObservers(handlerName),
    };
  }

  /** Summary of all registered handlers keyed by handler class name. */
  getAllHandlerSummaries(): Map<string, HandlerSummary> {
    const result = new Map<string, HandlerSummary>();
    for (const handlerName of this.handlerIntents.keys()) {
      const summary = this.getHandlerSummary(handlerName);
      if (summary) result.set(handlerName, summary);
    }
    return result;
  }

  private async emitIntentObservers(
    bindings: AxisObserverBinding[],
    context: Parameters<ObserverDispatcherService["dispatch"]>[1],
  ): Promise<void> {
    if (!this.observerDispatcher) return;
    await this.observerDispatcher.dispatch(
      bindings.length > 0 ? bindings : undefined,
      context,
    );
  }

  private async runIntentSensors(
    sensorBindings: AxisIntentSensorBinding[],
    intent: string,
    frame: AxisFrame,
    stage: "before" | "after",
    extras?: {
      decodedBody?: unknown;
      effect?: AxisEffect;
    },
  ): Promise<void> {
    for (const binding of sensorBindings) {
      if (binding.when !== stage && binding.when !== "both") continue;

      const sensorRef = binding.ref;
      const sensor = this.resolveIntentSensor(sensorRef);
      const sensorName = sensorRefKey(sensorRef);

      if (!sensor) {
        this.logger.error(
          `Intent sensor ${sensorName} is not registered for ${intent}`,
        );
        throw new Error(`SENSOR_MISSING:${sensorName}`);
      }

      const sensorInput: SensorInput = {
        rawBytes: frame.body,
        intent,
        body: frame.body,
        headerTLVs: frame.headers as any,
        frameBody: frame.body,
        metadata: {
          phase: "intent",
          stage,
          intent,
          schema: this.getSchema(intent),
          validators: this.getValidators(intent),
          decodedBody: extras?.decodedBody,
          effect: extras?.effect,
        },
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

  trackHandlerIntent(handlerName: string, intent: string): void {
    this.handlerByIntent.set(intent, handlerName);
    const existing = this.handlerIntents.get(handlerName);
    if (existing) {
      if (!existing.includes(intent)) existing.push(intent);
    } else {
      this.handlerIntents.set(handlerName, [intent]);
    }
  }

  /**
   * Stores class-level handler metadata (prefix, sensors, observers) gathered
   * at discovery time. Should be called once per handler class.
   */
  trackHandlerMeta(
    className: string,
    prefix: string,
    sensors: AxisIntentSensorBindingInput[],
    observers: AxisObserverBinding[],
  ): void {
    this.handlerPrefixes.set(className, prefix);
    this.handlerByPrefix.set(prefix, className);
    if (sensors.length > 0) {
      this.handlerClassSensors.set(
        className,
        mergeIntentSensorBindings(sensors),
      );
    }
    if (observers.length > 0) {
      this.handlerClassObservers.set(
        className,
        mergeObserverBindings(observers),
      );
    }
  }

  private resolveIntentSensor(
    ref: AxisIntentSensorRef,
  ): AxisSensor | undefined {
    const registered = this.sensorRegistry?.resolve(ref);
    if (registered) {
      return registered;
    }

    if (!this.dependencyResolver || typeof ref === "string") {
      return undefined;
    }

    const resolved = this.dependencyResolver.resolve(ref);
    return isAxisSensorInstance(resolved) ? resolved : undefined;
  }

  private getEffectiveCapsulePolicy(
    intent: string,
    frame: AxisFrame,
  ): CapsulePolicyOptions | undefined {
    const registeredPolicy = this.intentCapsulePolicies.get(intent);
    const chainConfig = this.intentChains.get(intent);
    const executionContext = getAxisExecutionContext(frame);

    const derivedScopes = Array.from(
      new Set([
        ...this.toScopeList(chainConfig?.capsuleScope),
        ...this.toScopeList(executionContext?.capsuleRef?.scope),
        ...this.toScopeList(executionContext?.chainStep?.capsuleScope),
      ]),
    );

    const requiresCapsule =
      chainConfig?.proofRequired ||
      executionContext?.capsuleRef?.proofRequired ||
      executionContext?.chainStep?.proofRequired ||
      executionContext?.chainEnvelope?.capsule?.proofRequired ||
      derivedScopes.length > 0;

    const derivedPolicy = requiresCapsule
      ? normalizeCapsulePolicyOptions({
          required: true,
          scopes: derivedScopes.length > 0 ? derivedScopes : undefined,
        })
      : undefined;

    return mergeCapsulePolicyOptions(registeredPolicy, derivedPolicy);
  }

  private enforceCapsulePolicy(
    intent: string,
    frame: AxisFrame,
    body: unknown,
    policy?: CapsulePolicyOptions,
  ): void {
    const executionContext = getAxisExecutionContext(frame);
    const inlineCapsuleRecord = this.toInlineCapsuleRecord(
      executionContext?.inlineCapsule,
    );
    const inlineCapsule = normalizeInlineCapsule(inlineCapsuleRecord);
    const normalizedPolicy = policy
      ? normalizeCapsulePolicyOptions(policy)
      : undefined;

    if (!inlineCapsule) {
      if (normalizedPolicy?.required) {
        if (
          normalizedPolicy.allowCapsuleRef &&
          this.hasCapsuleReference(frame) &&
          this.toScopeList(normalizedPolicy.scopes).length === 0 &&
          normalizedPolicy.intentBound === false
        ) {
          return;
        }

        throw new AxisError(
          this.hasCapsuleReference(frame)
            ? "CAPSULE_CLAIMS_REQUIRED"
            : "CAPSULE_REQUIRED",
          `Intent ${intent} requires an inline capsule for policy enforcement`,
          403,
          { intent },
        );
      }

      return;
    }

    if (isInlineCapsuleExpired(inlineCapsule)) {
      throw new AxisError(
        "CAPSULE_EXPIRED",
        `Capsule for ${intent} is expired`,
        403,
        { intent, capsuleId: inlineCapsule.id },
      );
    }

    const actorId =
      this.getActorIdFromFrame(frame) || executionContext?.actorId;
    if (
      actorId &&
      inlineCapsule.actorId &&
      !this.identifiersMatch(actorId, inlineCapsule.actorId)
    ) {
      throw new AxisError(
        "CAPSULE_ACTOR_MISMATCH",
        `Capsule actor does not match request actor for ${intent}`,
        403,
        {
          intent,
          actorId,
          capsuleActorId: inlineCapsule.actorId,
        },
      );
    }

    const proofRef = this.getProofRefFromFrame(frame);
    if (
      proofRef &&
      inlineCapsule.id &&
      !this.identifiersMatch(proofRef, inlineCapsule.id)
    ) {
      throw new AxisError(
        "CAPSULE_REF_MISMATCH",
        `Capsule reference does not match request proof for ${intent}`,
        403,
        {
          intent,
          proofRef,
          capsuleId: inlineCapsule.id,
        },
      );
    }

    const realm = this.getHeaderValue(frame, TLV_REALM);
    if (realm && inlineCapsule.realm && realm !== inlineCapsule.realm) {
      throw new AxisError(
        "CAPSULE_REALM_MISMATCH",
        `Capsule realm does not match request realm for ${intent}`,
        403,
        { intent, realm, capsuleRealm: inlineCapsule.realm },
      );
    }

    const node = this.getHeaderValue(frame, TLV_NODE);
    if (node && inlineCapsule.node && node !== inlineCapsule.node) {
      throw new AxisError(
        "CAPSULE_NODE_MISMATCH",
        `Capsule node does not match request node for ${intent}`,
        403,
        { intent, node, capsuleNode: inlineCapsule.node },
      );
    }

    const shouldCheckIntent = normalizedPolicy?.intentBound ?? true;
    if (
      shouldCheckIntent &&
      !inlineCapsuleAllowsIntent(inlineCapsule, intent)
    ) {
      throw new AxisError(
        "CAPSULE_DENIED",
        `Capsule does not authorize ${intent}`,
        403,
        {
          intent,
          capsuleId: inlineCapsule.id,
          allowedIntents: inlineCapsule.intents,
        },
      );
    }

    const requiredScopes = this.toScopeList(normalizedPolicy?.scopes);
    if (requiredScopes.length === 0) {
      return;
    }

    let resolvedScopes: string[];
    try {
      resolvedScopes = resolvePolicyScopes(requiredScopes, {
        body,
        intent,
        actorId,
        chainId: executionContext?.chainEnvelope?.chainId,
        stepId: executionContext?.chainStep?.stepId,
      });
    } catch (error: any) {
      this.logger.error(`Scope template error for ${intent}: ${error.message}`);
      throw new AxisError(
        "CAPSULE_SCOPE_TEMPLATE_UNRESOLVED",
        "Scope policy validation failed",
        400,
        { intent },
      );
    }

    if (
      !inlineCapsuleSatisfiesScopes(
        inlineCapsule,
        resolvedScopes,
        normalizedPolicy?.scopeMode ?? "all",
      )
    ) {
      throw new AxisError(
        "SCOPE_MISMATCH",
        `Capsule scopes do not satisfy ${intent}`,
        403,
        {
          intent,
          requiredScopes: resolvedScopes,
          availableScopes: inlineCapsule.scopes || [],
        },
      );
    }
  }

  private async executeChainRequest(
    frame: AxisFrame,
    request: AxisChainRequest<unknown, Record<string, unknown>>,
  ): Promise<AxisEffect> {
    const { AxisChainExecutor } = await import("./axis-chain.executor");
    const headerActorId = this.getActorIdFromFrame(frame);
    if (
      request.actorId &&
      headerActorId &&
      !this.identifiersMatch(request.actorId, headerActorId)
    ) {
      throw new AxisError(
        "ACTOR_MISMATCH",
        "CHAIN.EXEC actorId conflicts with authenticated frame identity",
        403,
      );
    }
    const actorId = headerActorId || request.actorId;
    const inlineCapsule = this.toInlineCapsuleRecord(request.capsule);
    const capsuleId = this.extractInlineCapsuleId(inlineCapsule);
    const headers = new Map(frame.headers);

    if (capsuleId) {
      headers.set(TLV_CAPSULE, this.encoder.encode(capsuleId));
      headers.set(TLV_PROOF_REF, this.encoder.encode(capsuleId));
    }

    const baseFrame = withAxisExecutionContext(
      {
        ...frame,
        headers,
      },
      mergeAxisExecutionContext(getAxisExecutionContext(frame), {
        metaIntent: "CHAIN.EXEC",
        actorId,
        inlineCapsule,
        capsuleRef: request.envelope.capsule,
        chainEnvelope: request.envelope,
      }) || {},
    );

    const executor = new AxisChainExecutor(this, this.observerDispatcher);
    const result = await executor.execute(request.envelope, {
      actorId,
      baseFrame,
    });

    return {
      ok: result.status !== "FAILED",
      effect: "chain.complete",
      body: this.encodeJson(result),
      metadata: {
        chainId: result.chainId,
        status: result.status,
      },
    };
  }

  private parseIntentExecBody(bytes: Uint8Array): {
    intent: string;
    args?: unknown;
    capsule?: Record<string, unknown>;
    execNonce?: string;
  } {
    try {
      return JSON.parse(this.decoder.decode(bytes));
    } catch (error: any) {
      throw new Error(`INTENT.EXEC unwrapping failed: ${error.message}`);
    }
  }

  private parseChainRequestBody(
    bytes: Uint8Array,
  ): AxisChainRequest<unknown, Record<string, unknown>> {
    let jsonError: Error | undefined;

    try {
      const parsed = JSON.parse(this.decoder.decode(bytes));
      if (this.isChainRequestLike(parsed)) {
        return {
          envelope: parsed.envelope,
          capsule: this.toInlineCapsuleRecord(parsed.capsule),
          actorId:
            typeof parsed.actorId === "string" ? parsed.actorId : undefined,
        };
      }

      if (this.isChainEnvelopeLike(parsed)) {
        return { envelope: parsed };
      }
    } catch (error: any) {
      jsonError = error;
    }

    try {
      const decoded = decodeChainRequest<unknown, Record<string, unknown>>(
        bytes,
      );
      return {
        envelope: decoded.envelope,
        capsule: this.toInlineCapsuleRecord(decoded.capsule),
        actorId: decoded.actorId,
      };
    } catch (requestError: any) {
      try {
        return {
          envelope: decodeChainEnvelope(bytes) as AxisChainEnvelope,
        };
      } catch (envelopeError: any) {
        const reason = [
          jsonError?.message,
          requestError.message,
          envelopeError.message,
        ]
          .filter(Boolean)
          .join(" | ");
        throw new Error(`CHAIN.EXEC decode failed: ${reason}`);
      }
    }
  }

  private isChainRequestLike(
    value: unknown,
  ): value is AxisChainRequest<unknown, Record<string, unknown>> {
    return (
      !!value &&
      typeof value === "object" &&
      "envelope" in value &&
      this.isChainEnvelopeLike((value as Record<string, unknown>).envelope)
    );
  }

  private isChainEnvelopeLike(value: unknown): value is AxisChainEnvelope {
    return (
      !!value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).chainId === "string" &&
      Array.isArray((value as Record<string, unknown>).steps)
    );
  }

  private encodeJson(value: unknown): Uint8Array {
    return this.encoder.encode(JSON.stringify(value));
  }

  private getActorIdFromFrame(frame: AxisFrame): string | undefined {
    return this.getHeaderValue(frame, TLV_ACTOR_ID);
  }

  private getProofRefFromFrame(frame: AxisFrame): string | undefined {
    return (
      this.getHeaderValue(frame, TLV_PROOF_REF) ||
      this.getHeaderValue(frame, TLV_CAPSULE)
    );
  }

  private hasCapsuleReference(frame: AxisFrame): boolean {
    return !!this.getProofRefFromFrame(frame);
  }

  private getHeaderValue(frame: AxisFrame, tag: number): string | undefined {
    const value = frame.headers.get(tag);
    if (!value || value.length === 0) {
      return undefined;
    }

    const decoded = this.decoder.decode(value);
    if (/^[\x20-\x7e]+$/.test(decoded)) {
      return decoded;
    }

    return Buffer.from(value).toString("hex");
  }

  private identifiersMatch(left: string, right: string): boolean {
    const normalize = (value: string) =>
      /^[0-9a-f]+$/i.test(value) ? value.toLowerCase() : value;
    return normalize(left) === normalize(right);
  }

  private extractInlineCapsuleId(
    capsule?: Record<string, unknown>,
  ): string | undefined {
    const id = capsule?.id;
    return typeof id === "string" && id.length > 0 ? id : undefined;
  }

  private toInlineCapsuleRecord(
    value: unknown,
  ): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private toScopeList(value?: string | string[]): string[] {
    if (!value) {
      return [];
    }

    return Array.isArray(value) ? value : [value];
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
