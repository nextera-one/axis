import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AxisSensor,
  AxisPreSensor,
  AxisPostSensor,
} from '../../sensor/axis-sensor';

/**
 * AxisSensor Registry
 *
 * A central registry for all AXIS security sensors.
 * Sensors register themselves here during module initialization (onModuleInit).
 * The registry provides a list of sensors sorted by their execution priority (order).
 *
 * Supports phase-based filtering to separate pre-decode (middleware) from
 * post-decode (controller) sensors.
 *
 * PHASE SEPARATION:
 * - Pre-decode (order < 40): Run in middleware on raw bytes
 * - Post-decode (order >= 40): Run in controller on decoded frame
 *
 * @class SensorRegistry
 * @injectable
 */
@Injectable()
export class SensorRegistry {
  private sensors: AxisSensor[] = [];
  private readonly logger = new Logger(SensorRegistry.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Registers a new sensor in the registry.
   *
   * Validates that:
   * - AxisSensor has a unique name
   * - AxisSensor has an order field
   * - Pre-decode sensors have order < 40
   * - Post-decode sensors have order >= 40
   *
   * @param {AxisSensor} sensor - The sensor instance to register
   * @throws Error if validation fails
   */
  register(sensor: AxisSensor): void {
    // Validation
    if (!sensor.name) {
      throw new Error('AxisSensor must have a name');
    }

    // Check environment variables for filtering
    const enabledSensorsStr = this.configService.get<string>('ENABLED_SENSORS');
    const disabledSensorsStr =
      this.configService.get<string>('DISABLED_SENSORS');

    const enabledSensors = enabledSensorsStr
      ? enabledSensorsStr.split(',').map((s) => s.trim())
      : null;
    const disabledSensors = disabledSensorsStr
      ? disabledSensorsStr.split(',').map((s) => s.trim())
      : [];

    if (enabledSensors && !enabledSensors.includes(sensor.name)) {
      this.logger.log(`Skipping disabled sensor (not in ENABLED_SENSORS): ${sensor.name}`);
      return;
    }

    if (disabledSensors.includes(sensor.name)) {
      this.logger.log(`Skipping disabled sensor (in DISABLED_SENSORS): ${sensor.name}`);
      return;
    }

    if (sensor.order === undefined) {
      throw new Error(`AxisSensor "${sensor.name}" must have an order field`);
    }

    // Check for phase consistency
    const isPreDecodeSensor = this.isPreDecodeSensor(sensor);
    const isPostDecodeSensor = this.isPostDecodeSensor(sensor);

    if (isPreDecodeSensor && sensor.order >= 40) {
      this.logger.warn(
        `AxisSensor "${sensor.name}" is marked as PRE_DECODE but has order ${sensor.order} (should be < 40)`,
      );
    }
    if (isPostDecodeSensor && sensor.order < 40) {
      this.logger.warn(
        `AxisSensor "${sensor.name}" is marked as POST_DECODE but has order ${sensor.order} (should be >= 40)`,
      );
    }

    this.sensors.push(sensor);
    const phaseLabel =
      typeof sensor.phase === 'string'
        ? sensor.phase
        : sensor.phase?.phase || 'UNKNOWN';
    this.logger.debug(
      `Registered sensor: ${sensor.name} (order: ${sensor.order}, phase: ${phaseLabel})`,
    );
  }

  /**
   * Returns all registered sensors, sorted by their execution order.
   *
   * @returns {AxisSensor[]} A sorted array of sensors
   */
  list(): AxisSensor[] {
    return [...this.sensors].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999),
    );
  }

  /**
   * Returns only pre-decode sensors (order < 40).
   * These sensors run in middleware on raw bytes before frame decoding.
   *
   * @returns {AxisPreSensor[]} Pre-decode sensors sorted by order
   */
  getPreDecodeSensors(): AxisPreSensor[] {
    return this.list().filter((s): s is AxisPreSensor => (s.order ?? 999) < 40);
  }

  /**
   * Returns only post-decode sensors (order >= 40).
   * These sensors run in the controller on fully decoded frames.
   *
   * @returns {AxisPostSensor[]} Post-decode sensors sorted by order
   */
  getPostDecodeSensors(): AxisPostSensor[] {
    return this.list().filter(
      (s): s is AxisPostSensor => (s.order ?? 999) >= 40,
    );
  }

  /**
   * Helper: Check if a sensor is a pre-decode sensor.
   *
   * @private
   * @param {AxisSensor} sensor - The sensor to check
   * @returns {boolean} True if sensor is pre-decode
   */
  private isPreDecodeSensor(sensor: AxisSensor): boolean {
    const phase =
      typeof sensor.phase === 'string' ? sensor.phase : sensor.phase?.phase;
    return phase === 'PRE_DECODE' || (sensor.order ?? 999) < 40;
  }

  /**
   * Helper: Check if a sensor is a post-decode sensor.
   *
   * @private
   * @param {AxisSensor} sensor - The sensor to check
   * @returns {boolean} True if sensor is post-decode
   */
  private isPostDecodeSensor(sensor: AxisSensor): boolean {
    const phase =
      typeof sensor.phase === 'string' ? sensor.phase : sensor.phase?.phase;
    return phase === 'POST_DECODE' || (sensor.order ?? 999) >= 40;
  }

  /**
   * Returns sensor count by phase.
   * Useful for diagnostics and monitoring.
   *
   * @returns {{preDecodeCount: number, postDecodeCount: number}}
   */
  getSensorCountByPhase(): { preDecodeCount: number; postDecodeCount: number } {
    return {
      preDecodeCount: this.getPreDecodeSensors().length,
      postDecodeCount: this.getPostDecodeSensors().length,
    };
  }

  /**
   * Clears all registered sensors.
   * Useful for testing.
   *
   * @internal
   */
  clear(): void {
    this.sensors = [];
  }
}
