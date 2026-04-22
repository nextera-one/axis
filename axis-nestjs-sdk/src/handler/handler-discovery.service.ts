import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";

import {
  OBSERVER_BINDINGS_KEY,
  HANDLER_SENSORS_KEY,
  INTENT_METADATA_KEY,
  INTENT_ROUTES_KEY,
} from "@nextera.one/axis-server-sdk";
import type {
  AxisObserverBinding,
  AxisIntentSensorBindingInput,
  IntentRoute,
} from "@nextera.one/axis-server-sdk";
import { HANDLER_METADATA_KEY } from "./handler.decorator";
import { IntentRouter } from "../engine/intent.router";

/**
 * HandlerDiscoveryService
 *
 * Automatically discovers all `@Handler`-decorated classes at bootstrap
 * and registers their `@Intent`-decorated methods with the IntentRouter.
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

      const handlerMeta = Reflect.getMetadata(HANDLER_METADATA_KEY, metatype);
      if (!handlerMeta) continue;

      const handlerName = handlerMeta.intent || metatype.name;
      const prefix = handlerMeta.intent || metatype.name;
      const proto = Object.getPrototypeOf(instance);
      const methods = this.scanner.getAllMethodNames(proto);
      const routes: IntentRoute[] =
        Reflect.getMetadata(INTENT_ROUTES_KEY, metatype) || [];
      const routedMethods = new Set(
        routes.map((route) => String(route.methodName)),
      );
      let registered = 0;

      const handlerSensors: AxisIntentSensorBindingInput[] =
        Reflect.getMetadata(HANDLER_SENSORS_KEY, metatype) || [];
      const handlerObservers: AxisObserverBinding[] =
        Reflect.getMetadata(OBSERVER_BINDINGS_KEY, metatype) || [];

      for (const route of routes) {
        const intentName = route.absolute
          ? route.action
          : `${prefix}.${route.action}`;

        if (!this.router.has(intentName)) {
          this.router.register(
            intentName,
            (instance as any)[route.methodName].bind(instance),
          );
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

        const intentName = meta.absolute
          ? meta.intent
          : `${prefix}.${meta.intent}`;

        if (!this.router.has(intentName)) {
          this.router.register(
            intentName,
            (instance as any)[methodName].bind(instance),
          );
          registered++;
          totalIntents++;
        }

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
