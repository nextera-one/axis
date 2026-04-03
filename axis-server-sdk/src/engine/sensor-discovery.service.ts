import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import {
  SENSOR_METADATA_KEY,
  SensorOptions,
} from '../decorators/sensor.decorator';
import { SensorRegistry } from './registry/sensor.registry';
import { AxisSensor } from '../sensor/axis-sensor';
import { PRE_DECODE_BOUNDARY } from './sensor-bands';

/**
 * Discovers all providers decorated with @Sensor() and registers them
 * in the SensorRegistry at application bootstrap.
 *
 * Runs after all onModuleInit() calls, so config-reading sensors
 * have their settings loaded before registration.
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

      // Phase priority: decorator option > instance property > auto-derive from order
      if (!sensor.phase) {
        const decoratorPhase = meta !== true ? meta.phase : undefined;
        (sensor as any).phase =
          decoratorPhase ??
          (sensor.order < PRE_DECODE_BOUNDARY ? 'PRE_DECODE' : 'POST_DECODE');
      }

      this.registry.register(sensor);
      count++;
    }

    this.logger.log(`Auto-registered ${count} sensors via @Sensor()`);
  }
}
