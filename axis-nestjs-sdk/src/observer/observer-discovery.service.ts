import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryService, Reflector } from "@nestjs/core";
import {
  OBSERVER_METADATA_KEY,
  type AxisIntentObserver,
  type AxisObserverDefinition,
} from "@nextera.one/axis-server-sdk";

import { ObserverRegistry } from "./observer.registry";

@Injectable()
export class ObserverDiscoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ObserverDiscoveryService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly registry: ObserverRegistry,
  ) {}

  onApplicationBootstrap() {
    const providers = this.discovery.getProviders();
    let count = 0;

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || !instance.constructor) continue;

      const meta = this.reflector.get<AxisObserverDefinition>(
        OBSERVER_METADATA_KEY,
        instance.constructor,
      );
      if (!meta) continue;

      const observer = instance as AxisIntentObserver;
      if (typeof observer.observe !== "function") {
        this.logger.warn(
          `@Observer on ${instance.constructor.name} is missing observe() and was skipped`,
        );
        continue;
      }

      this.registry.register(observer, meta);
      count++;
    }

    this.logger.log(`Auto-registered ${count} observers via @Observer()`);
  }
}
