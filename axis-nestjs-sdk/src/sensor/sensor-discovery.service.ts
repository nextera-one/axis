import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DiscoveryService, Reflector } from "@nestjs/core";

import {
  AxisSensor,
  PRE_DECODE_BOUNDARY,
  SENSOR_METADATA_KEY,
  type SensorOptions,
} from "@nextera.one/axis-server-sdk";
import { SensorRegistry } from "./sensor.registry";

/**
 * Discovers all providers decorated with @Sensor() and registers them
 * in the SensorRegistry at application bootstrap.
 */
@Injectable()
export class SensorDiscoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SensorDiscoveryService.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly registry: SensorRegistry,
  ) {}

  onApplicationBootstrap() {
    const providers = this.discovery.getProviders();
    let count = 0;

    for (const wrapper of providers) {
      const { instance } = wrapper;
      if (!instance || !instance.constructor) continue;

      const meta = this.reflector.get<SensorOptions | true>(
        SENSOR_METADATA_KEY,
        instance.constructor,
      );
      if (!meta) continue;

      const sensor = instance as AxisSensor;

      if (!sensor.name || sensor.order === undefined) {
        this.logger.warn(
          `@Sensor() on ${instance.constructor.name} missing name or order — skipped`,
        );
        continue;
      }

      if (!sensor.phase) {
        const decoratorPhase = meta !== true ? meta.phase : undefined;
        (sensor as any).phase =
          decoratorPhase ??
          (sensor.order < PRE_DECODE_BOUNDARY ? "PRE_DECODE" : "POST_DECODE");
      }

      this.registry.register(sensor);
      count++;
    }

    this.logger.log(`Auto-registered ${count} sensors via @Sensor()`);
  }
}
