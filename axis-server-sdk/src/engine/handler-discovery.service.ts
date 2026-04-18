import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import { OBSERVER_BINDINGS_KEY, type AxisObserverBinding } from "../decorators/observer.decorator";
import { HANDLER_SENSORS_KEY } from "../decorators/handler-sensors.decorator";
import { HANDLER_METADATA_KEY } from "../decorators/handler.decorator";
import { INTENT_METADATA_KEY, INTENT_ROUTES_KEY, IntentRoute } from "../decorators/intent.decorator";
import { IntentRouter } from "./intent.router";

/**
 * HandlerDiscoveryService
 *
 * Automatically discovers all `@Handler`-decorated classes at bootstrap
 * and registers their `@Intent`-decorated methods with the IntentRouter.
 *
 * This eliminates the need for every handler to inject IntentRouter and
 * manually call `router.register()` or `router.registerHandler()` in onModuleInit.
 *
 * **Before** (manual, per-handler boilerplate):
 * ```typescript
 * onModuleInit() {
 *   this.router.register('axis.capsules.create', this.create.bind(this));
 *   this.router.register('axis.capsules.list', this.findAll.bind(this));
 *   // ... repeated for every intent in every handler
 * }
 * ```
 *
 * **After** (zero-config):
 * ```typescript
 * @Handler('axis.capsules')
 * export class AxisCapsulesHandler {
 *   @Intent('axis.capsules.create', { absolute: true })
 *   async create(body: Uint8Array) { ... }
 * }
 * // That's it — no onModuleInit, no router injection
 * ```
 */
@Injectable()
export class HandlerDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(HandlerDiscoveryService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly router: IntentRouter,
  ) {}

  onModuleInit() {
    const providers = this.discovery.getProviders();
    let totalIntents = 0;

    for (const wrapper of providers) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      // Check if the class has @Handler metadata
      const handlerMeta = Reflect.getMetadata(HANDLER_METADATA_KEY, metatype);
      if (!handlerMeta) continue;

      const handlerName = handlerMeta.intent || metatype.name;
      const prefix = handlerMeta.intent || metatype.name;
      const proto = Object.getPrototypeOf(instance);
      const methods = this.scanner.getAllMethodNames(proto);
      const routes: IntentRoute[] =
        Reflect.getMetadata(INTENT_ROUTES_KEY, metatype) || [];
      const routedMethods = new Set(routes.map((route) => String(route.methodName)));
      let registered = 0;

      // Read @HandlerSensors from the class (if any)
      const handlerSensors: Function[] =
        Reflect.getMetadata(HANDLER_SENSORS_KEY, metatype) || [];
      const handlerObservers: AxisObserverBinding[] =
        Reflect.getMetadata(OBSERVER_BINDINGS_KEY, metatype) || [];

      for (const route of routes) {
        const intentName = route.absolute
          ? route.action
          : `${prefix}.${route.action}`;

        if (!this.router.has(intentName)) {
          this.router.register(intentName, (instance as any)[route.methodName].bind(instance));
          registered++;
          totalIntents++;
        }

        this.router.registerIntentMeta(
          intentName,
          proto,
          String(route.methodName),
          handlerSensors,
          handlerObservers,
        );
      }

      for (const methodName of methods) {
        if (routedMethods.has(methodName)) continue;

        const meta = Reflect.getMetadata(
          INTENT_METADATA_KEY,
          proto,
          methodName,
        );
        if (!meta?.intent) continue;

        const intentName = meta.absolute ? meta.intent : `${prefix}.${meta.intent}`;

        // Only auto-register if the router doesn't already have this intent
        // (allows manual registration in onModuleInit to take precedence)
        if (!this.router.has(intentName)) {
          this.router.register(
            intentName,
            (instance as any)[methodName].bind(instance),
          );
          registered++;
          totalIntents++;
        }

        // Always register metadata (@IntentBody, @IntentSensors) —
        // even for manually-registered intents
        this.router.registerIntentMeta(
          intentName,
          proto,
          methodName,
          handlerSensors,
          handlerObservers,
        );
      }

      if (registered > 0) {
        this.logger.log(
          `Auto-registered ${registered} intents from ${handlerName}`,
        );
      }
    }

    this.logger.log(
      `Handler discovery complete: ${totalIntents} intents auto-registered`,
    );
  }
}
